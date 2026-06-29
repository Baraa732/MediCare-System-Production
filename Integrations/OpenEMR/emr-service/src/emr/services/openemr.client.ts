import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios, { AxiosInstance } from 'axios';
import { Repository } from 'typeorm';
import { OpenEmrOAuthConfig } from '../entities/openemr-oauth-config.entity';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';

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
      throw new Error(`OpenEMR client registration failed (${response.status}): ${JSON.stringify(response.data)}`);
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
      throw new Error(`OpenEMR token request failed (${response.status}): ${JSON.stringify(response.data)}`);
    }

    const expiresIn = Number(response.data.expires_in || 300);
    this.tokenCache = {
      accessToken: response.data.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
    };

    return this.tokenCache.accessToken;
  }

  async createPatient(input: OpenEmrPatientInput): Promise<string> {
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
      throw new Error(`OpenEMR patient create failed (${response.status}): ${JSON.stringify(response.data)}`);
    }

    const openemrId =
      response.data?.id ||
      response.data?.pid?.toString() ||
      response.data?.uuid ||
      response.headers?.location?.split('/').pop();

    if (!openemrId) {
      throw new Error(`OpenEMR returned success but no patient id: ${JSON.stringify(response.data)}`);
    }

    this.logger.log(`Created OpenEMR patient ${openemrId} for MediCare user ${input.userId}`);
    return String(openemrId);
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
      throw new Error(`OpenEMR FHIR read failed (${response.status}): ${JSON.stringify(response.data)}`);
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
      throw new Error(`OpenEMR FHIR search failed (${resourceType}) (${response.status}): ${JSON.stringify(response.data)}`);
    }

    return response.data;
  }
}
