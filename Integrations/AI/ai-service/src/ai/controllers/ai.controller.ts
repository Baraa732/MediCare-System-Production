import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AiEnabledGuard } from '../guards/ai-enabled.guard';
import { Roles } from '../decorators/roles.decorator';
import { AiService, AiCallContext } from '../services/ai.service';
import { AiRateLimitService } from '../services/ai-rate-limit.service';
import { AiMetricsService } from '../services/ai-metrics.service';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { TenantGuard } from '../../tenant-shared/tenant.guard';
import { TenantAuthorizationGuard } from '../../tenant-shared/tenant-authorization.guard';
import { SkipTenantAuthorization } from '../../tenant-shared/tenant.decorators';
import { PLATFORM_TENANT_SCOPE } from '../../tenant-shared/tenant.constants';
import { DeepSeekService } from '../services/deepseek.service';
import { GeminiService } from '../services/gemini.service';
import {
  SummaryDto,
  MedicalReportDto,
  OcrCleanupDto,
  PatientChatDto,
  DoctorChatDto,
  AppointmentNoteDto,
  ClinicalAssessmentDto,
  RecommendationsDto,
} from '../dto/ai.dto';
import { PatientBookingAssistantDto } from '../dto/booking-assistant.dto';
import { PatientBookingSessionDto } from '../dto/booking-session.dto';
import { BookingAgentService } from '../services/booking-agent.service';
import { BookingSessionService } from '../services/booking-session.service';
import { BookingRedactionInterceptor } from '../interceptors/booking-redaction.interceptor';
import { OutboundResponseInterceptor } from '../interceptors/outbound-response.interceptor';

interface AuthUser {
  userId: string;
  role: string;
}

@ApiTags('AI')
@ApiBearerAuth()
@Controller('v1/ai')
@UseGuards(JwtAuthGuard, TenantGuard, TenantAuthorizationGuard, AiEnabledGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class AiController {
  constructor(
    private aiService: AiService,
    private rateLimitService: AiRateLimitService,
    private metricsService: AiMetricsService,
    private deepSeekService: DeepSeekService,
    private geminiService: GeminiService,
    private bookingAgentService: BookingAgentService,
    private bookingSessionService: BookingSessionService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private ctx(req: { user: AuthUser }, endpoint: string): AiCallContext {
    return { userId: req.user.userId, role: req.user.role, endpoint };
  }

  private async enforceRateLimit(userId: string): Promise<void> {
    await this.rateLimitService.check(
      userId,
      this.tenantContext.getTenantId() ?? PLATFORM_TENANT_SCOPE,
    );
  }

  @Get('status')
  @UseGuards(RolesGuard)
  @Roles('SYSTEM_MANAGER', 'CLINIC_ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Get AI service provider status' })
  getStatus() {
    const patientProvider = this.deepSeekService.isConfigured()
      ? 'deepseek (auto)'
      : this.geminiService.isConfigured()
        ? 'gemini (auto)'
        : 'none';
    return {
      deepseek: this.deepSeekService.getStatus(),
      gemini: this.geminiService.getStatus(),
      patientChatProvider: patientProvider,
      metrics: this.metricsService.getMetrics(),
      tenantMetrics: this.metricsService.getTenantMetrics(),
    };
  }

  @Get('metrics')
  @UseGuards(RolesGuard)
  @Roles('SYSTEM_MANAGER')
  @ApiOperation({ summary: 'Get AI usage metrics (platform admin only)' })
  getMetrics() {
    return this.metricsService.getMetrics();
  }

  @Post('summary')
  @UseGuards(RolesGuard)
  @Roles('SECRETARY', 'SYSTEM_MANAGER', 'CLINIC_ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Generate clinical text summary' })
  @ApiResponse({ status: 200, description: 'Summary generated' })
  @ApiResponse({ status: 503, description: 'AI unavailable' })
  async summary(@Body() dto: SummaryDto, @Request() req: { user: AuthUser }) {
    await this.enforceRateLimit(req.user.userId);
    return this.aiService.generateSummary(dto.text, this.ctx(req, 'summary'));
  }

  @Post('report')
  @UseGuards(RolesGuard)
  @Roles('DOCTOR', 'SYSTEM_MANAGER')
  @ApiOperation({ summary: 'Generate medical report draft' })
  async report(@Body() dto: MedicalReportDto, @Request() req: { user: AuthUser }) {
    await this.enforceRateLimit(req.user.userId);
    return this.aiService.generateMedicalReport(dto, this.ctx(req, 'report'));
  }

  @Post('ocr-cleanup')
  @UseGuards(RolesGuard)
  @Roles('SECRETARY', 'SYSTEM_MANAGER', 'CLINIC_ADMIN')
  @ApiOperation({ summary: 'Clean OCR text and extract structured data' })
  async ocrCleanup(@Body() dto: OcrCleanupDto, @Request() req: { user: AuthUser }) {
    await this.enforceRateLimit(req.user.userId);
    return this.aiService.cleanOCRText(dto, this.ctx(req, 'ocr-cleanup'));
  }

  @Post('patient-chat')
  @UseGuards(RolesGuard)
  @UseInterceptors(OutboundResponseInterceptor)
  @Roles('PATIENT', 'SYSTEM_MANAGER')
  @ApiOperation({ summary: 'Patient health information assistant' })
  async patientChat(@Body() dto: PatientChatDto, @Request() req: { user: AuthUser }) {
    await this.enforceRateLimit(req.user.userId);
    return this.aiService.patientAssistant(dto, this.ctx(req, 'patient-chat'));
  }

  @Post('doctor-chat')
  @UseGuards(RolesGuard)
  @UseInterceptors(OutboundResponseInterceptor)
  @Roles('DOCTOR', 'SYSTEM_MANAGER', 'CLINIC_ADMIN')
  @ApiOperation({ summary: 'Doctor documentation assistant' })
  async doctorChat(@Body() dto: DoctorChatDto, @Request() req: { user: AuthUser }) {
    await this.enforceRateLimit(req.user.userId);
    return this.aiService.doctorAssistant(dto, this.ctx(req, 'doctor-chat'));
  }

  @Post('appointment-note')
  @UseGuards(RolesGuard)
  @Roles('DOCTOR', 'SECRETARY', 'CLINIC_ADMIN', 'SYSTEM_MANAGER')
  @ApiOperation({ summary: 'Generate professional appointment note from brief notes' })
  async appointmentNote(
    @Body() dto: AppointmentNoteDto,
    @Request() req: { user: AuthUser },
  ) {
    await this.enforceRateLimit(req.user.userId);
    return this.aiService.generateAppointmentNote(dto, this.ctx(req, 'appointment-note'));
  }

  @Post('clinical-assessment')
  @UseGuards(RolesGuard)
  @Roles('DOCTOR', 'SYSTEM_MANAGER')
  @ApiOperation({ summary: 'Generate clinical assessment draft' })
  async clinicalAssessment(
    @Body() dto: ClinicalAssessmentDto,
    @Request() req: { user: AuthUser },
  ) {
    await this.enforceRateLimit(req.user.userId);
    return this.aiService.generateClinicalAssessment(dto.data, this.ctx(req, 'clinical-assessment'));
  }

  @Post('recommendations')
  @UseGuards(RolesGuard)
  @Roles('DOCTOR', 'SYSTEM_MANAGER')
  @ApiOperation({ summary: 'Generate care recommendations draft' })
  async recommendations(
    @Body() dto: RecommendationsDto,
    @Request() req: { user: AuthUser },
  ) {
    await this.enforceRateLimit(req.user.userId);
    return this.aiService.generateRecommendations(dto.data, this.ctx(req, 'recommendations'));
  }

  @Post('patient-booking-session')
  @SkipTenantAuthorization()
  @UseGuards(RolesGuard)
  @UseInterceptors(BookingRedactionInterceptor)
  @Roles('PATIENT', 'SYSTEM_MANAGER')
  @ApiOperation({ summary: 'Initialize a server-managed booking assistant session' })
  async patientBookingSession(
    @Body() dto: PatientBookingSessionDto,
    @Request() req: { user: AuthUser },
  ) {
    await this.enforceRateLimit(req.user.userId);
    return this.bookingSessionService.initSession(req.user.userId, dto.resumeToken);
  }

  @Post('patient-booking-assistant')
  @SkipTenantAuthorization()
  @UseGuards(RolesGuard)
  @UseInterceptors(BookingRedactionInterceptor)
  @Roles('PATIENT', 'SYSTEM_MANAGER')
  @ApiOperation({ summary: 'AI appointment booking assistant (conversational)' })
  async patientBookingAssistant(
    @Body() dto: PatientBookingAssistantDto,
    @Request() req: { user: AuthUser; headers?: { authorization?: string } },
  ) {
    await this.enforceRateLimit(req.user.userId);
    return this.bookingAgentService.processMessage(
      dto.sessionId,
      dto.message,
      req.user.userId,
      req.headers?.authorization,
    );
  }
}
