import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios, { AxiosInstance } from 'axios';
import { Repository } from 'typeorm';
import { OpenEmrOAuthConfig } from '../entities/openemr-oauth-config.entity';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { PhiAuditPublisherService } from '../../phi-audit-shared/phi-audit.publisher';
import { PhiAuditAction, PhiAuditResourceType } from '../../phi-audit-shared/types';

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

export interface OpenEmrPatientInput {
  userId: string;
  phoneNumber: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  gender?: string;
  birthDate?: string;
}

const FHIR_READ_SCOPES = [
  'openid',
  'offline_access',
  'api:fhir',
  'user/Patient.crs',
  'user/Patient.rs',
  'user/AllergyIntolerance.rs',
  'user/Condition.rs',
  'user/MedicationRequest.rs',
  'user/Encounter.rs',
  'user/Observation.rs',
  'user/DiagnosticReport.rs',
  'user/DocumentReference.rs',
  'user/Coverage.rs',
  'user/RelatedPerson.rs',
  'user/Immunization.rs',
  'user/CarePlan.rs',
  'user/Procedure.rs',
].join(' ');

@Injectable()
export class OpenEmrClient implements OnModuleInit {
  private readonly logger = new Logger(OpenEmrClient.name);
  private readonly http: AxiosInstance;
  private tokenCache: TokenCache | null = null;
  private clientId: string | null = null;
  private clientSecret: string | null = null;

  constructor(
    private configService: ConfigService,
    @InjectRepository(OpenEmrOAuthConfig)
    private oauthConfigRepository: Repository<OpenEmrOAuthConfig>,
    private readonly tenantContext: TenantContextService,
    private readonly phiAudit: PhiAuditPublisherService,
  ) {
    this.http = axios.create({
      timeout: 30_000,
      validateStatus: () => true,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureOAuthClient();
    } catch (error: any) {
      this.logger.warn(`OpenEMR OAuth setup deferred: ${error.message}`);
    }
  }

  get baseUrl(): string {
    return (this.configService.get<string>('OPENEMR_BASE_URL') || 'https://openemr').replace(/\/$/, '');
  }

  get site(): string {
    return this.configService.get<string>('OPENEMR_SITE') || 'default';
  }

  private oauthUrl(path: string): string {
    return `${this.baseUrl}/oauth2/${this.site}${path}`;
  }

  private apiUrl(path: string): string {
    return `${this.baseUrl}/apis/${this.site}${path}`;
  }

  async isReachable(): Promise<boolean> {
    try {
      const response = await this.http.get(`${this.baseUrl}/meta/health/readyz`, {
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
      });
      return response.status >= 200 && response.status < 300;
    } catch {
      return false;
    }
  }

  async ensureOAuthClient(): Promise<void> {
    const envClientId = this.configService.get<string>('OPENEMR_CLIENT_ID')?.trim();
    const envClientSecret = this.configService.get<string>('OPENEMR_CLIENT_SECRET')?.trim();

    if (envClientId && envClientSecret) {
      this.clientId = envClientId;
      this.clientSecret = envClientSecret;
      this.logger.log('Using OpenEMR OAuth client from environment');
      return;
    }

    const tenantId = this.tenantContext.getTenantId();
    const stored = tenantId
      ? await this.oauthConfigRepository.findOne({ where: { tenantId } })
      : await this.oauthConfigRepository.findOne({ where: { id: 1 } });
    if (!stored && tenantId) {
      const fallback = await this.oauthConfigRepository.findOne({ where: { id: 1 } });
      if (fallback) {
        this.clientId = fallback.clientId;
        this.clientSecret = fallback.clientSecret;
        await this.enableOAuthClient(this.clientId);
        this.logger.log(`Using platform OpenEMR OAuth client for tenant ${tenantId}`);
        return;
      }
    }
    if (stored) {
      this.clientId = stored.clientId;
      this.clientSecret = stored.clientSecret;
      await this.enableOAuthClient(this.clientId);
      this.logger.log('Using stored OpenEMR OAuth client');
      return;
    }

    await this.registerOAuthClient();
  }

  private formatOpenEmrError(operation: string, status: number): string {
    return `${operation} failed (HTTP ${status})`;
  }

  private async registerOAuthClient(): Promise<void> {
    const payload = {
      application_type: 'private',
      redirect_uris: [`${this.baseUrl}/oauth2/${this.site}/redirect`],
      client_name: 'MediCare EMR Integration',
      token_endpoint_auth_method: 'client_secret_post',
      scope: FHIR_READ_SCOPES,
    };

    const response = await this.http.post(this.oauthUrl('/registration'), payload, {
      headers: { 'Content-Type': 'application/json' },
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(this.formatOpenEmrError('OpenEMR client registration', response.status));
    }

    this.clientId = response.data.client_id;
    this.clientSecret = response.data.client_secret;

    await this.enableOAuthClient(this.clientId!);

    await this.oauthConfigRepository.save({
      id: 1,
      tenantId: this.tenantContext.getTenantId() ?? undefined,
      clientId: this.clientId!,
      clientSecret: this.clientSecret!,
    });

    this.logger.log('Registered OpenEMR OAuth client for MediCare integration');
  }

  private async enableOAuthClient(clientId: string): Promise<void> {
    const host = this.configService.get<string>('OPENEMR_MYSQL_HOST') || 'mariadb-openemr';
    const user = this.configService.get<string>('OPENEMR_MYSQL_USER') || 'openemr';
    const password = this.configService.get<string>('OPENEMR_MYSQL_PASSWORD');
    const database = this.configService.get<string>('OPENEMR_MYSQL_DATABASE') || 'openemr';

    if (!password) {
      this.logger.warn('OPENEMR_MYSQL_PASSWORD not set — skipping OAuth client enable');
      return;
    }

    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({ host, user, password, database });
    try {
      await connection.execute(
        'UPDATE oauth_clients SET is_enabled = 1 WHERE client_id = ?',
        [clientId],
      );
      this.logger.log(`Enabled OpenEMR OAuth client ${clientId}`);
    } finally {
      await connection.end();
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 10_000) {
      return this.tokenCache.accessToken;
    }

    this.tokenCache = null;

    if (!this.clientId || !this.clientSecret) {
      await this.ensureOAuthClient();
    }

    const adminUser = this.configService.get<string>('OPENEMR_ADMIN_USER') || 'admin';
    const adminPass = this.configService.get<string>('OPENEMR_ADMIN_PASSWORD') || 'pass';

    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: this.clientId!,
      client_secret: this.clientSecret!,
      scope: FHIR_READ_SCOPES,
      user_role: 'users',
      username: adminUser,
      password: adminPass,
    });

    const response = await this.http.post(this.oauthUrl('/token'), body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    });

    if (response.status < 200 || response.status >= 300 || !response.data?.access_token) {
      this.logger.warn(
        `OpenEMR token request failed (HTTP ${response.status}); FHIR reads will be skipped`,
      );
      throw new Error(this.formatOpenEmrError('OpenEMR token request', response.status));
    }

    const expiresIn = Number(response.data.expires_in || 300);
    this.tokenCache = {
      accessToken: response.data.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
    };

    return this.tokenCache.accessToken;
  }

  async createPatient(input: OpenEmrPatientInput): Promise<string> {
    try {
      const token = await this.getAccessToken();

      const fhirPatient = {
        resourceType: 'Patient',
        identifier: [
          { system: 'urn:medicare:user-id', value: input.userId },
          { system: 'urn:medicare:phone', value: input.phoneNumber },
          { system: 'urn:medicare:tenant-id', value: input.tenantId },
        ],
        name: [{
          use: 'official',
          family: input.lastName || 'Patient',
          given: [input.firstName || 'MediCare'],
        }],
        telecom: [{ system: 'phone', value: input.phoneNumber, use: 'mobile' }],
        gender: this.mapGender(input.gender),
        birthDate: input.birthDate || '1990-01-01',
      };

      const response = await this.http.post(this.apiUrl('/fhir/Patient'), fhirPatient, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/fhir+json',
          Accept: 'application/fhir+json',
        },
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
      });

      if (response.status < 200 || response.status >= 300) {
        throw new Error(this.formatOpenEmrError('OpenEMR patient create', response.status));
      }

      const openemrId =
        response.data?.id ||
        response.data?.pid?.toString() ||
        response.data?.uuid ||
        response.headers?.location?.split('/').pop();

      if (!openemrId) {
        throw new Error('OpenEMR returned success but no patient id');
      }

      this.logger.log(`Created OpenEMR patient ${openemrId} for MediCare user ${input.userId}`);

      this.phiAudit.emit({
        action: PhiAuditAction.EMR_CHART_WRITE,
        actorRole: 'SYSTEM',
        tenantId: input.tenantId,
        resourceType: PhiAuditResourceType.EMR_CHART,
        resourceId: input.userId,
        success: true,
        classification: 'phi',
        internalCall: true,
      });

      return String(openemrId);
    } catch (error) {
      this.phiAudit.emit({
        action: PhiAuditAction.EMR_CHART_WRITE,
        actorRole: 'SYSTEM',
        tenantId: input.tenantId,
        resourceType: PhiAuditResourceType.EMR_CHART,
        resourceId: input.userId,
        success: false,
        classification: 'phi',
        internalCall: true,
      });
      throw error;
    }
  }

  private mapGender(gender?: string): 'male' | 'female' | 'other' {
    if (!gender) return 'other';
    const normalized = gender.toLowerCase();
    if (normalized === 'male' || normalized === 'm') return 'male';
    if (normalized === 'female' || normalized === 'f') return 'female';
    return 'other';
  }

  async fhirRead<T = unknown>(path: string): Promise<T | null> {
    const token = await this.getAccessToken();
    const response = await this.http.get(this.apiUrl(path), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/fhir+json',
      },
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    });

    if (response.status === 404) return null;
    if (response.status < 200 || response.status >= 300) {
      throw new Error(this.formatOpenEmrError('OpenEMR FHIR read', response.status));
    }

    return response.data as T;
  }

  async fhirSearch(resourceType: string, params: Record<string, string>): Promise<unknown> {
    const token = await this.getAccessToken();
    const query = new URLSearchParams(params).toString();
    const response = await this.http.get(this.apiUrl(`/fhir/${resourceType}?${query}`), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/fhir+json',
      },
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    });

    if (response.status === 404) {
      return { resourceType: 'Bundle', type: 'searchset', entry: [] };
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(this.formatOpenEmrError(`OpenEMR FHIR search (${resourceType})`, response.status));
    }

    return response.data;
  }

  /**
   * OpenEMR Standard REST (`/apis/{site}/api/...`), not FHIR.
   * Used for patient-portal writes of `patient_data` fields.
   */
  async standardPut<T = unknown>(path: string, body: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const response = await this.http.put(this.apiUrl(path), body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(this.formatOpenEmrError(`OpenEMR standard PUT ${path}`, response.status));
    }

    return response.data as T;
  }
}
