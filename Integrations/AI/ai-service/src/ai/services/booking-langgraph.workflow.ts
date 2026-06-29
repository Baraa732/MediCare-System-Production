import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { BookingSession } from '../security/references/reference.types';
import { BookingToolOrchestrator } from '../security/tools/booking-tool-orchestrator.service';
import { BookingPolicyService } from '../security/booking-policy.service';
import { OutboundSanitizerService } from '../security/outbound-sanitizer.service';
import { RedactionService } from '../security/redaction.service';
import { PatientMemoryFacade } from '../memory/patient-memory.facade';
import { LlmProviderRegistry } from '../providers/llm-provider.registry';
import { LlmMessage, LlmToolCall, LlmToolDefinition } from '../providers/llm-provider';

const BOOKING_GRAPH_SYSTEM_PROMPT = `You are a medical appointment booking assistant.
You can only help with appointment workflows.
Never disclose internal identifiers, UUIDs, endpoints, tokens, or hidden reasoning.

When you need an operation, call one tool using JSON.
When no tool is required, return a direct user answer.
`;

const PLANNER_TOOLS: LlmToolDefinition[] = [
  {
    name: 'searchClinics',
    description: 'Find clinics by free-text query.',
    parameters: { query: 'string' },
  },
  {
    name: 'getClinicDoctors',
    description: 'List doctors for a clinic ref.',
    parameters: { clinicRef: 'string' },
  },
  {
    name: 'findAvailableSlots',
    description: 'Find available slots for clinicRef+doctorRef+date(YYYY-MM-DD).',
    parameters: { clinicRef: 'string', doctorRef: 'string', date: 'YYYY-MM-DD' },
  },
  {
    name: 'confirmBooking',
    description: 'Confirm booking using slotRef.',
    parameters: { slotRef: 'string' },
  },
  {
    name: 'cancelBooking',
    description: 'Cancel booking using appointmentRef.',
    parameters: { appointmentRef: 'string', reason: 'string (optional)' },
  },
  {
    name: 'loadPatientMemory',
    description: 'Load additional patient memory context.',
    parameters: {},
  },
];

const BookingWorkflowState = Annotation.Root({
  patientId: Annotation<string>,
  sessionId: Annotation<string>,
  authHeader: Annotation<string | undefined>,
  userMessage: Annotation<string>,
  sanitizedMessage: Annotation<string>,
  session: Annotation<BookingSession>,
  memoryContext: Annotation<string>,
  iteration: Annotation<number>,
  plannerReply: Annotation<string>,
  plannerToolCall: Annotation<LlmToolCall | null>,
  toolSummaryHistory: Annotation<string[]>,
  finalReply: Annotation<string>,
  errorMessage: Annotation<string | null>,
  nextNode: Annotation<string>,
});

type BookingWorkflowStateType = typeof BookingWorkflowState.State;

export interface BookingWorkflowInput {
  patientId: string;
  sessionId: string;
  authHeader?: string;
  message: string;
  session: BookingSession;
}

export interface BookingWorkflowResult {
  reply: string;
  session: BookingSession;
}

@Injectable()
export class BookingLangGraphWorkflow {
  private readonly logger = new Logger(BookingLangGraphWorkflow.name);
  private compiled?: any;
  private readonly maxIterations: number;

  constructor(
    private readonly config: ConfigService,
    private readonly redaction: RedactionService,
    private readonly policy: BookingPolicyService,
    private readonly memoryFacade: PatientMemoryFacade,
    private readonly outboundSanitizer: OutboundSanitizerService,
    private readonly providerRegistry: LlmProviderRegistry,
    private readonly orchestrator: BookingToolOrchestrator,
  ) {
    this.maxIterations = parseInt(this.config.get<string>('BOOKING_GRAPH_MAX_ITERATIONS') || '6', 10);
  }

  async run(input: BookingWorkflowInput): Promise<BookingWorkflowResult> {
    const graph = this.getGraph();
    const result = await graph.invoke({
      patientId: input.patientId,
      sessionId: input.sessionId,
      authHeader: input.authHeader,
      userMessage: input.message,
      sanitizedMessage: '',
      session: input.session,
      memoryContext: '',
      iteration: 0,
      plannerReply: '',
      plannerToolCall: null,
      toolSummaryHistory: [],
      finalReply: '',
      errorMessage: null,
      nextNode: 'plannerNode',
    });

    return {
      reply:
        result.finalReply ||
        "I'm having trouble processing your request. Could you try rephrasing?",
      session: result.session,
    };
  }

  private getGraph() {
    if (this.compiled) return this.compiled;

    const graph = new StateGraph(BookingWorkflowState)
      .addNode('inputSafetyNode', this.inputSafetyNode.bind(this))
      .addNode('loadMemoryNode', this.loadMemoryNode.bind(this))
      .addNode('plannerNode', this.plannerNode.bind(this))
      .addNode('toolExecutionNode', this.toolExecutionNode.bind(this))
      .addNode('responseValidationNode', this.responseValidationNode.bind(this))
      .addNode('responseNode', this.responseNode.bind(this))
      .addEdge(START, 'inputSafetyNode')
      .addEdge('inputSafetyNode', 'loadMemoryNode')
      .addEdge('loadMemoryNode', 'plannerNode')
      .addConditionalEdges('plannerNode', (state) => state.nextNode, {
        toolExecutionNode: 'toolExecutionNode',
        responseValidationNode: 'responseValidationNode',
        responseNode: 'responseNode',
      })
      .addConditionalEdges('toolExecutionNode', (state) => state.nextNode, {
        plannerNode: 'plannerNode',
        responseValidationNode: 'responseValidationNode',
      })
      .addEdge('responseValidationNode', 'responseNode')
      .addEdge('responseNode', END);

    this.compiled = graph.compile();
    return this.compiled;
  }

  private async inputSafetyNode(state: BookingWorkflowStateType): Promise<Partial<BookingWorkflowStateType>> {
    const sanitizedMessage = this.redaction.sanitizeUserInput((state.userMessage || '').trim());
    const decision = this.policy.validateUserMessage(sanitizedMessage);
    if (!decision.allowed) {
      throw new ForbiddenException(decision.reason || 'Invalid request.');
    }
    return {
      sanitizedMessage,
      nextNode: 'plannerNode',
    };
  }

  private async loadMemoryNode(state: BookingWorkflowStateType): Promise<Partial<BookingWorkflowStateType>> {
    const memoryContext = await this.memoryFacade.loadPatientMemory(state.patientId);
    return { memoryContext };
  }

  private async plannerNode(state: BookingWorkflowStateType): Promise<Partial<BookingWorkflowStateType>> {
    if (state.iteration >= this.maxIterations) {
      return {
        plannerReply: "I'm having trouble processing your request. Could you try rephrasing?",
        nextNode: 'responseValidationNode',
      };
    }

    const provider = this.providerRegistry.resolve();
    if (!(await provider.ensureAvailable())) {
      return {
        plannerReply: 'AI service temporarily unavailable',
        nextNode: 'responseValidationNode',
      };
    }

    const promptBody = [
      state.memoryContext ? `Patient memory:\n${state.memoryContext}` : '',
      this.buildSessionContext(state.session),
      state.toolSummaryHistory.length ? `Tool summaries:\n${state.toolSummaryHistory.join('\n')}` : '',
      `User: ${state.sanitizedMessage}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    this.outboundSanitizer.assertPromptClean(promptBody);

    const messages: LlmMessage[] = [
      { role: 'system', content: BOOKING_GRAPH_SYSTEM_PROMPT },
      { role: 'user', content: promptBody },
    ];

    try {
      const response = await provider.generate(messages, PLANNER_TOOLS, {
        temperature: 0.2,
        maxTokens: 700,
      });
      if (response.toolCall?.name) {
        return {
          plannerToolCall: response.toolCall,
          plannerReply: '',
          iteration: state.iteration + 1,
          nextNode: 'toolExecutionNode',
        };
      }
      return {
        plannerReply: response.text || '',
        plannerToolCall: null,
        iteration: state.iteration + 1,
        nextNode: 'responseValidationNode',
      };
    } catch (error) {
      this.logger.warn(`plannerNode failed: ${(error as Error).message}`);
      return {
        errorMessage: 'AI planning failed',
        plannerReply: "I'm having trouble processing your request. Could you try rephrasing?",
        nextNode: 'responseValidationNode',
      };
    }
  }

  private async toolExecutionNode(
    state: BookingWorkflowStateType,
  ): Promise<Partial<BookingWorkflowStateType>> {
    const mapped = this.mapToolCall(state.plannerToolCall);
    if (!mapped) {
      return {
        plannerReply: 'I can help with clinics, doctors, slots, and bookings.',
        nextNode: 'responseValidationNode',
      };
    }

    if (mapped.tool === 'load_memory') {
      const memoryContext = await this.memoryFacade.loadPatientMemory(state.patientId);
      return {
        memoryContext,
        plannerToolCall: null,
        toolSummaryHistory: [
          ...state.toolSummaryHistory,
          'TOOL loadPatientMemory SUMMARY: Memory context loaded.',
        ],
        nextNode: 'plannerNode',
      };
    }

    const { result, summary, session } = await this.orchestrator.executeTool(
      mapped.tool,
      mapped.params,
      {
        patientId: state.patientId,
        sessionId: state.sessionId,
        userMessage: state.sanitizedMessage,
        authHeader: state.authHeader,
      },
      state.session,
    );

    const statusNote = result.success ? summary : `${summary} (${result.error || 'failed'})`;
    return {
      session,
      plannerToolCall: null,
      toolSummaryHistory: [...state.toolSummaryHistory, `TOOL ${mapped.tool} SUMMARY: ${statusNote}`],
      nextNode: 'plannerNode',
    };
  }

  private async responseValidationNode(
    state: BookingWorkflowStateType,
  ): Promise<Partial<BookingWorkflowStateType>> {
    const candidate =
      state.plannerReply ||
      state.errorMessage ||
      "I'm having trouble processing your request. Could you try rephrasing?";
    const cleaned = this.cleanForUser(candidate);
    const finalReply = this.outboundSanitizer.sanitizeUserResponse(cleaned);
    return { finalReply, nextNode: 'responseNode' };
  }

  private async responseNode(state: BookingWorkflowStateType): Promise<Partial<BookingWorkflowStateType>> {
    if (state.finalReply?.trim()) return {};
    return {
      finalReply: "I'm having trouble processing your request. Could you try rephrasing?",
    };
  }

  private mapToolCall(
    toolCall: LlmToolCall | null,
  ): { tool: string; params: Record<string, unknown> } | null {
    if (!toolCall?.name) return null;
    const name = toolCall.name.trim();
    const params = toolCall.args || {};

    if (name === 'searchClinics') {
      return { tool: 'search_clinics', params: { query: String(params.query || '') } };
    }
    if (name === 'getClinicDoctors') {
      return { tool: 'list_doctors', params: { clinicRef: String(params.clinicRef || '') } };
    }
    if (name === 'findAvailableSlots') {
      return {
        tool: 'get_available_slots',
        params: {
          clinicRef: String(params.clinicRef || ''),
          doctorRef: String(params.doctorRef || ''),
          date: String(params.date || ''),
        },
      };
    }
    if (name === 'confirmBooking') {
      return { tool: 'book_appointment', params: { slotRef: String(params.slotRef || '') } };
    }
    if (name === 'cancelBooking') {
      return {
        tool: 'cancel_appointment',
        params: {
          appointmentRef: String(params.appointmentRef || ''),
          ...(params.reason ? { reason: String(params.reason) } : {}),
        },
      };
    }
    if (name === 'loadPatientMemory') {
      return { tool: 'load_memory', params: {} };
    }
    return null;
  }

  private buildSessionContext(session: BookingSession): string {
    const parts: string[] = [];
    if (session.clinicName) parts.push(`Clinic: ${session.clinicName}`);
    if (session.selectedClinicRef) parts.push(`clinicRef: ${session.selectedClinicRef}`);
    if (session.doctorName) parts.push(`Doctor: ${session.doctorName}`);
    if (session.selectedDoctorRef) parts.push(`doctorRef: ${session.selectedDoctorRef}`);
    if (session.date) parts.push(`Date: ${session.date}`);
    if (session.pendingSlotRef) parts.push(`slotRef: ${session.pendingSlotRef}`);
    if (session.pendingAppointmentRef) parts.push(`appointmentRef: ${session.pendingAppointmentRef}`);
    if (!parts.length) return '';
    return `Session context: ${parts.join(', ')}`;
  }

  private cleanForUser(text: string): string {
    if (!text) return '';
    const withoutFence = text.replace(/^```[\w]*\s*/i, '').replace(/```\s*$/i, '');
    return withoutFence
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !/^user:/i.test(line) && !/^assistant:/i.test(line))
      .join('\n')
      .trim();
  }
}
