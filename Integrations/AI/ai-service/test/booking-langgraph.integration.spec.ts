import { ConfigService } from '@nestjs/config';
import { BookingLangGraphWorkflow } from '../src/ai/services/booking-langgraph.workflow';
import { RedactionService } from '../src/ai/security/redaction.service';
import { BookingPolicyService } from '../src/ai/security/booking-policy.service';
import { PatientMemoryFacade } from '../src/ai/memory/patient-memory.facade';
import { OutboundSanitizerService } from '../src/ai/security/outbound-sanitizer.service';
import { LlmProviderRegistry } from '../src/ai/providers/llm-provider.registry';
import { BookingToolOrchestrator } from '../src/ai/security/tools/booking-tool-orchestrator.service';
import { InternalIdentifierLeakError } from '../src/ai/security/internal-identifier-leak.error';
import { PatientMemoryFacade as PatientMemoryFacadeImpl } from '../src/ai/memory/patient-memory.facade';

const UUID_ANY =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

describe('BookingLangGraphWorkflow integration invariants', () => {
  function buildWorkflow(overrides?: {
    generate?: jest.Mock;
    executeTool?: jest.Mock;
    loadMemory?: jest.Mock;
  }) {
    const generate =
      overrides?.generate ||
      jest.fn().mockResolvedValue({ text: 'I can help with booking appointments.' });
    const executeTool =
      overrides?.executeTool ||
      jest.fn().mockResolvedValue({
        result: { success: true, data: { clinics: [{ clinicRef: 'CLN-A7K2' }] } },
        summary: '1 clinic found',
        session: { step: 'pick_doctor', selectedClinicRef: 'CLN-A7K2' },
      });
    const loadMemory = overrides?.loadMemory || jest.fn().mockResolvedValue('');

    const provider = {
      providerName: 'gemini',
      isConfigured: () => true,
      ensureAvailable: jest.fn().mockResolvedValue(true),
      generate,
    } as any;

    const config = {
      get: (key: string) => {
        if (key === 'BOOKING_GRAPH_MAX_ITERATIONS') return '6';
        return undefined;
      },
    } as ConfigService;
    const redaction = new RedactionService();
    const policy = {
      validateUserMessage: () => ({ allowed: true }),
    } as unknown as BookingPolicyService;
    const memoryFacade = {
      loadPatientMemory: loadMemory,
      recordTurn: jest.fn(),
    } as unknown as PatientMemoryFacade;
    const outbound = new OutboundSanitizerService();
    const registry = {
      resolve: () => provider,
    } as unknown as LlmProviderRegistry;
    const orchestrator = {
      executeTool,
    } as unknown as BookingToolOrchestrator;

    const workflow = new BookingLangGraphWorkflow(
      config,
      redaction,
      policy,
      memoryFacade,
      outbound,
      registry,
      orchestrator,
    );

    return { workflow, generate, executeTool, loadMemory };
  }

  it('fails closed if prompt state carries UUID contamination', async () => {
    const { workflow } = buildWorkflow();

    await expect(
      workflow.run({
        patientId: 'patient-1',
        sessionId: 'session-1',
        message: 'book appointment',
        session: {
          step: 'pick_doctor',
          selectedClinicRef: 'a3d6d4b7-1edf-4476-a25f-c7f4f70df833',
        },
      }),
    ).rejects.toBeInstanceOf(InternalIdentifierLeakError);
  });

  it('does not leak tool payload internals into planner prompts', async () => {
    const calls: string[] = [];
    const generate = jest
      .fn()
      .mockImplementationOnce(async (messages: any[]) => {
        calls.push(JSON.stringify(messages));
        return {
          toolCall: {
            name: 'searchClinics',
            args: { query: 'damascus' },
          },
          text: '',
        };
      })
      .mockImplementationOnce(async (messages: any[]) => {
        calls.push(JSON.stringify(messages));
        return { text: 'I found Damascus Heart Clinic. Would you like doctors?' };
      });

    const executeTool = jest.fn().mockResolvedValue({
      result: {
        success: true,
        data: {
          // Must never be persisted into model prompt.
          clinics: [{ clinicRef: 'CLN-A7K2', clinicId: 'a3d6d4b7-1edf-4476-a25f-c7f4f70df833' }],
        },
      },
      summary: '1. Damascus Heart Clinic (Damascus)',
      session: { step: 'pick_doctor', selectedClinicRef: 'CLN-A7K2' },
    });

    const { workflow } = buildWorkflow({ generate, executeTool });

    const result = await workflow.run({
      patientId: 'patient-1',
      sessionId: 'session-1',
      message: 'find clinics in damascus',
      session: { step: 'start' },
    });

    expect(result.reply).toContain('Damascus Heart Clinic');
    expect(result.reply).not.toMatch(UUID_ANY);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[1]).not.toContain('a3d6d4b7-1edf-4476-a25f-c7f4f70df833');
  });

  it('uses refs only in tool execution params', async () => {
    const generate = jest
      .fn()
      .mockResolvedValueOnce({
        toolCall: {
          name: 'confirmBooking',
          args: { slotRef: 'SLT-M3Q8' },
        },
        text: '',
      })
      .mockResolvedValueOnce({ text: 'Your appointment has been booked.' });
    const executeTool = jest.fn().mockResolvedValue({
      result: { success: true, data: { appointmentRef: 'APT-R6T1' } },
      summary: 'Appointment booked successfully.',
      session: { step: 'completed', pendingAppointmentRef: 'APT-R6T1' },
    });
    const { workflow } = buildWorkflow({ generate, executeTool });

    const result = await workflow.run({
      patientId: 'patient-1',
      sessionId: 'session-1',
      message: 'book the first slot',
      session: { step: 'confirm_book', pendingSlotRef: 'SLT-M3Q8' },
    });

    expect(result.reply.toLowerCase()).toContain('booked');
    expect(executeTool).toHaveBeenCalledWith(
      'book_appointment',
      expect.objectContaining({ slotRef: 'SLT-M3Q8' }),
      expect.anything(),
      expect.anything(),
    );
    expect(JSON.stringify(executeTool.mock.calls[0][1])).not.toMatch(UUID_ANY);
  });
});

describe('PatientMemoryFacade invariants', () => {
  it('never stores refs or UUIDs in memory turns', async () => {
    const appendMessage = jest.fn().mockResolvedValue({});
    const facade = new PatientMemoryFacadeImpl(
      { hasConsent: jest.fn().mockResolvedValue(true) } as any,
      {
        isStorageEnabled: () => true,
        appendMessage,
      } as any,
      new OutboundSanitizerService(),
    );

    await facade.recordTurn(
      'patient-1',
      'Please book CLN-A7K2 with id a3d6d4b7-1edf-4476-a25f-c7f4f70df833',
      "Booked. Reference APT-R6T1 and internal id 01890a5d-ac96-774b-bcce-b302099a8057",
    );

    expect(appendMessage).toHaveBeenCalledTimes(2);
    const userPayload = appendMessage.mock.calls[0][2].plaintext;
    const assistantPayload = appendMessage.mock.calls[1][2].plaintext;

    expect(userPayload).not.toMatch(/\b(?:CLN|DOC|SLT|APT)-[A-Z0-9]{4}\b/);
    expect(userPayload).not.toMatch(UUID_ANY);
    expect(assistantPayload).not.toMatch(/\b(?:CLN|DOC|SLT|APT)-[A-Z0-9]{4}\b/);
    expect(assistantPayload).not.toMatch(UUID_ANY);
  });
});
