import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './controllers/ai.controller';
import { AiInternalController } from './controllers/ai-internal.controller';
import { AiRequest } from './entities/ai-request.entity';
import { AiConversationThread } from './entities/ai-conversation-thread.entity';
import { AiConversationMessage } from './entities/ai-conversation-message.entity';
import { AiConversationSummary } from './entities/ai-conversation-summary.entity';
import { AiPatientConsent } from './entities/ai-patient-consent.entity';
import { AiMemoryAuditLog } from './entities/ai-memory-audit-log.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AiEnabledGuard } from './guards/ai-enabled.guard';
import { InternalServiceGuard } from './guards/internal-service.guard';
import { OcrService } from './services/ocr.service';
import { DeepSeekService } from './services/deepseek.service';
import { GeminiService } from './services/gemini.service';
import { PromptService } from './services/prompt.service';
import { AiService } from './services/ai.service';
import { AiCacheService } from './services/ai-cache.service';
import { AiRateLimitService } from './services/ai-rate-limit.service';
import { AiRequestLogService } from './services/ai-request-log.service';
import { AiMetricsService } from './services/ai-metrics.service';
import { AiConcurrencyService } from './services/ai-concurrency.service';
import { TenantObservabilityService } from './services/tenant-observability.service';
import { AppointmentHttpClient } from './services/appointment-http.client-v2';
import { PatientContextService } from './services/patient-context.service';
import { ClinicHttpClient } from './services/clinic-http.client';
import { UserHttpClient } from './services/user-http.client';
import { SchedulingHttpClient } from './services/scheduling-http.client';
import { BookingSessionService } from './services/booking-session.service';
import { BookingToolsService } from './services/booking-tools.service';
import { BookingAgentService } from './services/booking-agent.service';
import { RedactionService } from './security/redaction.service';
import { OutboundSanitizerService } from './security/outbound-sanitizer.service';
import { BookingPolicyService } from './security/booking-policy.service';
import { InjectionDetectorService } from './security/injection-detector.service';
import { ToolResultSanitizerService } from './security/tool-result-sanitizer.service';
import { BookingRedactionInterceptor } from './interceptors/booking-redaction.interceptor';
import { OutboundResponseInterceptor } from './interceptors/outbound-response.interceptor';
import { ReferenceResolverService } from './security/references/reference-resolver.service';
import { ToolRegistry } from './security/tools/tool-registry.service';
import { BookingToolOrchestrator } from './security/tools/booking-tool-orchestrator.service';
import { KmsAdapterService } from './memory/kms-adapter.service';
import { EncryptionService } from './memory/encryption.service';
import { IntegrityService } from './memory/integrity.service';
import { ConversationService } from './memory/conversation.service';
import { ConsentService } from './memory/consent.service';
import { MemoryAuditService } from './memory/memory-audit.service';
import { LanguageDetectionService } from './memory/language-detection.service';
import { SummarizationService } from './memory/summarization.service';
import { PatientMemoryFacade } from './memory/patient-memory.facade';
import { LlmProviderRegistry } from './providers/llm-provider.registry';
import { GeminiLlmProvider } from './providers/gemini-llm.provider';
import { BookingLangGraphWorkflow } from './services/booking-langgraph.workflow';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      AiRequest,
      AiConversationThread,
      AiConversationMessage,
      AiConversationSummary,
      AiPatientConsent,
      AiMemoryAuditLog,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { algorithm: 'HS256' } as const,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AiController, AiInternalController],
  providers: [
    DeepSeekService,
    GeminiService,
    GeminiLlmProvider,
    LlmProviderRegistry,
    PromptService,
    OcrService,
    AiService,
    AiCacheService,
    AiRateLimitService,
    AiRequestLogService,
    AiMetricsService,
    AiConcurrencyService,
    TenantObservabilityService,
    AppointmentHttpClient,
    PatientContextService,
    ClinicHttpClient,
    UserHttpClient,
    SchedulingHttpClient,
    ReferenceResolverService,
    ToolRegistry,
    BookingToolOrchestrator,
    KmsAdapterService,
    EncryptionService,
    IntegrityService,
    ConversationService,
    ConsentService,
    MemoryAuditService,
    LanguageDetectionService,
    SummarizationService,
    PatientMemoryFacade,
    BookingSessionService,
    BookingToolsService,
    BookingLangGraphWorkflow,
    BookingAgentService,
    RedactionService,
    OutboundSanitizerService,
    InjectionDetectorService,
    BookingPolicyService,
    ToolResultSanitizerService,
    BookingRedactionInterceptor,
    OutboundResponseInterceptor,
    JwtAuthGuard,
    RolesGuard,
    AiEnabledGuard,
    InternalServiceGuard,
  ],
  exports: [
    AiService,
    AiMetricsService,
    AiCacheService,
    RedactionService,
    GeminiService,
    DeepSeekService,
  ],
})
export class AiModule {}
