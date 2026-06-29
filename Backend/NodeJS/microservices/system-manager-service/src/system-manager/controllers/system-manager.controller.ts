import { Controller, Post, Body, UseGuards, Request, ForbiddenException, Get, Query, Param, Res, Req } from '@nestjs/common';
import type { Request as ExpressRequest, Response } from 'express';
import { SystemManagerService } from '../services/system-manager.service';
import { PlatformHealthService } from '../services/platform-health.service';
import { PlatformStatsService } from '../services/platform-stats.service';
import { PlatformLogsService } from '../services/platform-logs.service';
import { PlatformObservabilityService } from '../services/platform-observability.service';
import { PlatformStreamService } from '../services/platform-stream.service';
import { PlatformIncidentsService } from '../services/platform-incidents.service';
import { SystemManagerLoginDto, CreateSystemManagerDto, CreateClinicAdminDto } from '../dto/system-manager.dto';
import { GenerateActivationCodeDto, ValidateActivationCodeDto, RevokeActivationCodeDto } from '../dto/clinic-admin-activation.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { InternalServiceGuard } from '../guards/internal-service.guard';

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
  ) {}

  @Post('login')
  async login(@Body() dto: SystemManagerLoginDto) {
    return this.systemManagerService.login(dto);
  }

  /** Called by API gateway to validate platform-manager JWT before proxying protected routes */
  @UseGuards(InternalServiceGuard, JwtAuthGuard)
  @Get('validate-token')
  async validateToken(@Request() req) {
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
  @Post('activation-code/generate')
  async generateActivationCode(@Body() dto: GenerateActivationCodeDto, @Request() req) {
    if (req.user.role !== 'SYSTEM_MANAGER') {
      throw new ForbiddenException('Only system managers can generate activation codes');
    }
    return this.systemManagerService.generateActivationCode(dto, req.user.userId);
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
  async getActivationCodeStatus(@Query('code') code: string) {
    return this.systemManagerService.getActivationCodeStatus(code);
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
}
