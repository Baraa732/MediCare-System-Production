import { Controller, Post, Body, UseGuards, Request, ForbiddenException, Get, Query, Param, Res, Req, UseInterceptors, UploadedFiles, BadRequestException } from '@nestjs/common';
import type { Request as ExpressRequest, Response } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SystemManagerService } from '../services/system-manager.service';
import { PlatformHealthService } from '../services/platform-health.service';
import { PlatformStatsService } from '../services/platform-stats.service';
import { PlatformLogsService } from '../services/platform-logs.service';
import { PlatformObservabilityService } from '../services/platform-observability.service';
import { PlatformStreamService } from '../services/platform-stream.service';
import { PlatformIncidentsService } from '../services/platform-incidents.service';
import { PlatformDataService } from '../services/platform-data.service';
import { PlatformSecurityService } from '../services/platform-security.service';
import { PlatformQueuesService } from '../services/platform-queues.service';
import { PlatformDeploymentsService } from '../services/platform-deployments.service';
import { PlatformBroadcastService } from '../services/platform-broadcast.service';
import { SystemManagerLoginDto, CreateSystemManagerDto, CreateClinicAdminDto } from '../dto/system-manager.dto';
import { ValidateActivationCodeDto, RevokeActivationCodeDto, CreateActivationCodeDto } from '../dto/clinic-admin-activation.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { InternalServiceGuard } from '../guards/internal-service.guard';
import type { ActivationDocumentField } from '../enums/clinic-activation.enums';
import type { ActivationUploadedFiles } from '../types/activation-documents.types';

const ACTIVATION_FILE_FIELDS: { name: ActivationDocumentField; maxCount: number }[] = [
  { name: 'nationalId', maxCount: 1 },
  { name: 'clinicLicense', maxCount: 1 },
  { name: 'governmentId', maxCount: 1 },
  { name: 'commercialRegistry', maxCount: 1 },
  { name: 'medicalDegree', maxCount: 1 },
  { name: 'specializationCertificate', maxCount: 1 },
  { name: 'boardCertifications', maxCount: 1 },
];

function mapUploadedActivationFiles(
  uploaded: Record<string, Array<{ buffer: Buffer; originalname: string; mimetype: string; size: number }>> | undefined,
): ActivationUploadedFiles {
  const files: ActivationUploadedFiles = {};
  if (!uploaded) return files;
  for (const field of ACTIVATION_FILE_FIELDS) {
    const entry = uploaded[field.name]?.[0];
    if (entry) files[field.name] = entry;
  }
  return files;
}

// LOW FIX: Add API versioning
@Controller('v1/system-manager')
export class SystemManagerController {
  constructor(
    private readonly systemManagerService: SystemManagerService,
    private readonly platformHealthService: PlatformHealthService,
    private readonly platformStatsService: PlatformStatsService,
    private readonly platformLogsService: PlatformLogsService,
    private readonly platformObservabilityService: PlatformObservabilityService,
    private readonly platformStreamService: PlatformStreamService,
    private readonly platformIncidentsService: PlatformIncidentsService,
    private readonly platformDataService: PlatformDataService,
    private readonly platformSecurityService: PlatformSecurityService,
    private readonly platformQueuesService: PlatformQueuesService,
    private readonly platformDeploymentsService: PlatformDeploymentsService,
    private readonly platformBroadcastService: PlatformBroadcastService,
  ) {}

  @Post('login')
  async login(@Body() dto: SystemManagerLoginDto) {
    return this.systemManagerService.login(dto);
  }

  /** Called by API gateway to validate platform-manager JWT before proxying protected routes */
  @UseGuards(InternalServiceGuard, JwtAuthGuard)
  @Get('validate-token')
  async validateToken(@Request() req) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Platform manager token required');
    }
    return {
      user: {
        id: req.user.userId,
        role: req.user.role,
        username: req.user.username,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('create')
  async create(@Body() dto: CreateSystemManagerDto, @Request() req) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can create other system managers');
    }
    return this.systemManagerService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('create-clinic-admin')
  async createClinicAdmin(@Body() dto: CreateClinicAdminDto, @Request() req) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can create clinic admins');
    }
    return this.systemManagerService.createClinicAdmin(dto, req.user.userId);
  }

  // Dev-only seed endpoint
  @Post('dev/seed')
  async seed(@Body() body: { username: string; password: string; firstName: string; lastName: string; email?: string; phoneNumber?: string }) {
    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException('Only available in development mode');
    }
    return this.systemManagerService.seedSystemManager(
      body.username,
      body.password,
      body.firstName,
      body.lastName,
      body.email,
      body.phoneNumber,
    );
  }

  // Seed default system manager (Baraa Al-Rifaee)
  @Post('dev/seed-default')
  async seedDefault() {
    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException('Only available in development mode');
    }
    return this.systemManagerService.seedDefaultSystemManager();
  }

  // Clinic Admin Activation Code Endpoints

  @UseGuards(JwtAuthGuard)
  @Post('activation-codes')
  async createActivationCode(@Body() dto: CreateActivationCodeDto, @Request() req) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can generate activation codes');
    }
    return this.systemManagerService.createActivationCode(dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('activation-codes/provision')
  @UseInterceptors(
    FileFieldsInterceptor(ACTIVATION_FILE_FIELDS, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async provisionActivationCode(
    @Body('payload') payloadJson: string,
    @UploadedFiles() uploaded: Record<string, Array<{ buffer: Buffer; originalname: string; mimetype: string; size: number }>>,
    @Request() req,
  ) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can generate activation codes');
    }

    if (!payloadJson) {
      throw new BadRequestException('Missing provisioning payload');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(payloadJson);
    } catch {
      throw new BadRequestException('Invalid provisioning payload JSON');
    }

    const dto = plainToInstance(CreateActivationCodeDto, parsed);
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length > 0) {
      const message = errors
        .flatMap((error) => Object.values(error.constraints ?? {}))
        .join('; ');
      throw new BadRequestException(message || 'Invalid provisioning payload');
    }

    const files = mapUploadedActivationFiles(uploaded);
    return this.systemManagerService.createActivationCode(dto, req.user.userId, files);
  }

  @UseGuards(JwtAuthGuard)
  @Get('activation-codes/:code/documents/:documentField')
  async getActivationDocument(
    @Param('code') code: string,
    @Param('documentField') documentField: string,
    @Res() res: Response,
    @Request() req,
  ) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can view activation documents');
    }

    const { buffer, mimeType, fileName } = await this.systemManagerService.getActivationDocument(
      code,
      documentField,
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(buffer);
  }

  /** @deprecated Prefer POST activation-codes */
  @UseGuards(JwtAuthGuard)
  @Post('activation-code/generate')
  async generateActivationCodeLegacy(@Body() dto: CreateActivationCodeDto, @Request() req) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can generate activation codes');
    }
    return this.systemManagerService.createActivationCode(dto, req.user.userId);
  }

  // This endpoint is now handled through Kafka by auth service
  // Clinic admins should use POST /auth/clinic-admin/activate instead
  // @Post('activation-code/validate')
  // async validateActivationCode(@Body() dto: ValidateActivationCodeDto) {
  //   const result = await this.systemManagerService.validateActivationCode(dto);
  //   return { message: result.message };
  // }

  // Internal: check if a phone number has a used (activated) code — called by auth-service during CLINIC_ADMIN registration
  @UseGuards(InternalServiceGuard)
  @Get('activation-code/check-activated')
  async checkActivated(@Query('phoneNumber') phoneNumber: string) {
    return this.systemManagerService.checkPhoneHasActivatedCode(phoneNumber);
  }

  @UseGuards(InternalServiceGuard)
  @Get('activation-code/lookup-used-by-phone')
  async lookupUsedActivationByPhone(@Query('phoneNumber') phoneNumber: string) {
    return this.systemManagerService.lookupUsedActivationByPhone(phoneNumber);
  }

  // Internal endpoint called by auth-service via HTTP (not Kafka)
  @UseGuards(InternalServiceGuard)
  @Post('activation-code/validate-internal')
  async validateActivationCodeInternal(@Body() dto: ValidateActivationCodeDto) {
    return this.systemManagerService.validateActivationCode(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('activation-code/revoke')
  async revokeActivationCode(@Body() dto: RevokeActivationCodeDto, @Request() req) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can revoke activation codes');
    }
    return this.systemManagerService.revokeActivationCode(dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('activation-code/status')
  async getActivationCodeStatus(@Query('code') code: string, @Request() req) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can view activation code status');
    }
    return this.systemManagerService.getActivationCodeStatus(code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('platform/clinics')
  async listPlatformClinics(@Request() req) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can view platform clinics');
    }
    return this.platformDataService.listClinics();
  }

  @UseGuards(JwtAuthGuard)
  @Post('platform/clinics')
  async createPlatformClinic(
    @Request() req,
    @Body() body: {
      name: string;
      description?: string;
      city?: string;
      governorate?: string;
      phone?: string;
      email?: string;
    },
  ) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can create clinics');
    }
    return this.platformDataService.createClinic(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('platform/users')
  async listPlatformUsers(
    @Request() req,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can view platform users');
    }
    return this.platformDataService.listUsers(
      Math.max(parseInt(page, 10) || 1, 1),
      Math.min(parseInt(limit, 10) || 20, 100),
    );
  }

  /** Manual platform broadcast — inbox + FCM push to every patient. */
  @UseGuards(JwtAuthGuard)
  @Post('platform/notifications/broadcast')
  async broadcastToPatients(
    @Request() req,
    @Body() body: { title?: string; body?: string },
  ) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can broadcast notifications');
    }
    return this.platformBroadcastService.broadcastToAllPatients(
      body?.title ?? '',
      body?.body ?? '',
    );
  }

  /** Manual platform broadcast — inbox + FCM push to every doctor. */
  @UseGuards(JwtAuthGuard)
  @Post('platform/notifications/broadcast-doctors')
  async broadcastToDoctors(
    @Request() req,
    @Body() body: { title?: string; body?: string },
  ) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can broadcast notifications');
    }
    return this.platformBroadcastService.broadcastToAllDoctors(
      body?.title ?? '',
      body?.body ?? '',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('platform/clinics/:clinicId/staff')
  async listPlatformClinicStaff(
    @Request() req,
    @Param('clinicId') clinicId: string,
  ) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can view clinic staff');
    }
    return this.platformDataService.listClinicStaff(clinicId);
  }

  /** One-shot repair: promote PENDING staff assignments to ACTIVE (seed / activation gap). */
  @UseGuards(JwtAuthGuard)
  @Post('platform/staff/activate-pending')
  async activatePendingPlatformStaff(@Request() req) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can repair staff assignments');
    }
    return this.platformDataService.activatePendingStaffAssignments();
  }

  @UseGuards(JwtAuthGuard)
  @Get('platform/health')
  async getPlatformHealth(@Request() req) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can view platform health');
    }
    return this.platformHealthService.getPlatformHealth();
  }

  @UseGuards(JwtAuthGuard)
  @Get('platform/stats')
  async getPlatformStats(@Request() req) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can view platform stats');
    }
    return this.platformStatsService.getPlatformStats();
  }

  @UseGuards(JwtAuthGuard)
  @Get('platform/logs')
  async getPlatformLogs(
    @Request() req,
    @Query('services') services?: string,
    @Query('levels') levels?: string,
    @Query('search') search?: string,
    @Query('range') range?: string,
    @Query('limit') limit?: string,
  ) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can view platform logs');
    }
    return this.platformLogsService.getPlatformLogs({
      services: services?.split(',').map((s) => s.trim()).filter(Boolean),
      levels: levels
        ?.split(',')
        .map((l) => l.trim().toUpperCase())
        .filter(Boolean) as any,
      search,
      range,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('platform/observability')
  async getPlatformObservability(@Request() req, @Query('range') range?: string): Promise<any> {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can view platform observability');
    }
    return this.platformObservabilityService.getOverview(range);
  }

  @UseGuards(JwtAuthGuard)
  @Get('platform/stream')
  streamPlatform(
    @Request() req,
    @Req() rawReq: ExpressRequest,
    @Res() res: Response,
    @Query('range') range?: string,
  ) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can subscribe to platform stream');
    }
    this.platformStreamService.handleConnection(rawReq, res, range ?? '1h');
  }

  @UseGuards(JwtAuthGuard)
  @Get('platform/traces/:traceId')
  async getTrace(@Request() req, @Param('traceId') traceId: string) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can view traces');
    }
    return this.platformObservabilityService.getTraceById(traceId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('platform/traces')
  async getTraceForService(
    @Request() req,
    @Query('service') service?: string,
    @Query('range') range?: string,
  ) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can view traces');
    }
    if (!service) return null;
    return this.platformObservabilityService.getTraceForService(service, range ?? '1h');
  }

  @UseGuards(JwtAuthGuard)
  @Get('platform/incidents')
  async listIncidents(@Request() req) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can view incidents');
    }
    return this.platformIncidentsService.list();
  }

  @UseGuards(JwtAuthGuard)
  @Post('platform/incidents/:id/acknowledge')
  async acknowledgeIncident(@Request() req, @Param('id') id: string, @Body() body: { title?: string; service?: string }) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can manage incidents');
    }
    return this.platformIncidentsService.acknowledge(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('platform/incidents/:id/assign')
  async assignIncident(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { assignee: string; title?: string; service?: string },
  ) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can manage incidents');
    }
    return this.platformIncidentsService.assign(id, body.assignee, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('platform/incidents/:id/resolve')
  async resolveIncident(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { notes?: string; title?: string; service?: string },
  ) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can manage incidents');
    }
    return this.platformIncidentsService.resolve(id, body.notes, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('platform/incidents/:id/escalate')
  async escalateIncident(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { notes?: string; title?: string; service?: string },
  ) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can manage incidents');
    }
    return this.platformIncidentsService.escalate(id, body.notes, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('platform/incidents/:id/silence')
  async silenceIncident(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { hours?: number; title?: string; service?: string },
  ) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can manage incidents');
    }
    return this.platformIncidentsService.silence(id, body.hours ?? 1, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('platform/alerts')
  async getFiringAlerts(@Request() req) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can view alerts');
    }
    return this.platformObservabilityService.getFiringAlerts();
  }

  @UseGuards(JwtAuthGuard)
  @Get('platform/security-summary')
  async getSecuritySummary(@Request() req, @Query('range') range?: string) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can view security summary');
    }
    return this.platformSecurityService.getSummary(range ?? '1h');
  }

  @UseGuards(JwtAuthGuard)
  @Get('platform/queues')
  async getQueues(@Request() req) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can view queues');
    }
    return this.platformQueuesService.getOverview();
  }

  @UseGuards(JwtAuthGuard)
  @Get('platform/deployments')
  async listDeployments(@Request() req, @Query('limit') limit?: string) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can view deployments');
    }
    return this.platformDeploymentsService.list(limit ? parseInt(limit, 10) : 20);
  }

  @UseGuards(InternalServiceGuard)
  @Post('internal/deployments')
  async ingestDeployment(
    @Body()
    body: {
      service: string;
      version?: string;
      status?: 'Success' | 'Failed' | 'Rolled back' | 'In progress';
      actor?: string;
      startedAt?: string;
      finishedAt?: string;
      durationMs?: number;
      source?: string;
    },
  ) {
    if (!body?.service) {
      throw new BadRequestException('service is required');
    }
    return this.platformDeploymentsService.ingest(body);
  }
}
