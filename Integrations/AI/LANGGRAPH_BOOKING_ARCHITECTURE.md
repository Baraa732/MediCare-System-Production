# LangGraph Booking Architecture

```mermaid
flowchart TD
    U[Patient Message] --> A[BookingAgentService]
    A --> B[inputSafetyNode]
    B --> C[loadMemoryNode]
    C --> D[plannerNode]
    D -->|tool call| E[toolExecutionNode]
    E --> D
    D -->|final answer| F[responseValidationNode]
    F --> G[responseNode]
    G --> UO[Sanitized User Reply]

    C --> PM[PatientMemoryFacade]
    PM --> CS[ConversationService]
    PM --> CONS[ConsentService]

    D --> LP[LlmProviderRegistry]
    LP --> GP[GeminiLlmProvider]
    GP --> GS[GeminiService]

    E --> ORCH[BookingToolOrchestrator]
    ORCH --> RR[ReferenceResolverService]
    ORCH --> BTS[BookingToolsService]
    ORCH --> BSS[BookingSessionService]
    ORCH --> TRS[ToolResultSanitizerService]

    B --> POL[BookingPolicyService / InjectionDetectorService]
    F --> OUT[OutboundSanitizerService]

    subgraph Security Invariants
      S1[No UUIDs in prompts]
      S2[No UUIDs in replies]
      S3[No tool payload persistence]
      S4[No refs/UUIDs in long-term memory]
      S5[Fail closed on prompt contamination]
    end

    B -.enforces.-> S5
    D -.enforces.-> S1
    F -.enforces.-> S2
    E -.enforces.-> S3
    PM -.enforces.-> S4
```

## Notes
- LangGraph orchestration is enabled by `LANGGRAPH_ENABLED=true`.
- Provider selection is configuration-based via `AI_PROVIDER` (initial provider: Gemini).
- LangGraph does not access PostgreSQL directly; all booking operations remain tool/API mediated.
