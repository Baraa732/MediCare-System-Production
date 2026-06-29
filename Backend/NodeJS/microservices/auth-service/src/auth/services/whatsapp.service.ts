// Synced from Integrations/WhatsApp/client/whatsapp.service.ts — edit source there, then: npm run sync:whatsapp

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

const WHATSAPP_TIMEOUT_MS = 10_000;
const CONNECTION_POLL_MS = 2_000;
const CONNECTION_WAIT_MS = Number(process.env.WHATSAPP_CONNECTION_WAIT_MS || 90_000);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
  private readonly apiKey = process.env.EVOLUTION_API_KEY;
  private readonly instanceName = process.env.WHATSAPP_INSTANCE_NAME || 'clinic-management';
  private profileNameSynced = false;

  /** Display name shown to recipients in WhatsApp (chat list / profile). */
  private get profileDisplayName(): string {
    return process.env.WHATSAPP_PROFILE_NAME?.trim() || 'MediCare';
  }

  private headers() {
    return { apikey: this.apiKey, 'Content-Type': 'application/json' };
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey?.trim());
  }

  /** Ensures the Evolution instance record exists; creates it if missing. */
  private async ensureInstanceRecord(): Promise<boolean> {
    if (!this.isConfigured()) return false;

    const exists = await this.instanceExists();
    if (exists) return true;

    await this.createInstance(this.instanceName);
    this.logger.log(`WhatsApp instance '${this.instanceName}' created — scan QR to connect`);
    return true;
  }

  /**
   * Prepare instance for messaging — creates record if missing, restores session if possible.
   * Never calls /instance/connect here; that endpoint is for manual QR pairing only.
   */
  private async ensureInstanceReady(): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('EVOLUTION_API_KEY is not set — WhatsApp OTP will not be sent');
      return;
    }

    try {
      if (!(await this.ensureInstanceRecord())) return;

      const state = await this.restorePersistedSession(this.instanceName);
      if (state === 'open') {
        await this.syncProfileDisplayName(this.instanceName);
        this.logger.log(`WhatsApp instance '${this.instanceName}' connected`);
        return;
      }

      this.logger.warn(
        `WhatsApp instance '${this.instanceName}' not connected (state=${state}). ` +
          'Pair manually: GET /api/auth/dev/whatsapp-qr then scan QR in WhatsApp.',
      );
    } catch (error: any) {
      this.logger.warn(`WhatsApp init: ${error.message}`);
    }
  }

  /** Poll until Evolution restores the session from DB/Redis/disk after startup. */
  private async waitForConnection(instanceName: string, maxWaitMs = CONNECTION_WAIT_MS): Promise<string> {
    const deadline = Date.now() + maxWaitMs;
    let lastState = 'close';

    while (Date.now() < deadline) {
      lastState = await this.getConnectionState(instanceName);
      if (lastState === 'open') return 'open';
      if (lastState === 'connecting') {
        await sleep(CONNECTION_POLL_MS);
        continue;
      }
      await sleep(CONNECTION_POLL_MS);
    }

    return lastState;
  }

  /**
   * Reconnect using saved credentials — does NOT log out or require a new QR scan.
   * See Evolution API: PUT /instance/restart/{instance}
   */
  async restartInstance(instanceName: string): Promise<void> {
    try {
      await axios.put(
        `${this.evolutionApiUrl}/instance/restart/${instanceName}`,
        {},
        { headers: this.headers(), timeout: WHATSAPP_TIMEOUT_MS },
      );
      this.logger.log(`WhatsApp instance '${instanceName}' restart requested (session preserved)`);
    } catch (error: any) {
      this.logger.warn(`WhatsApp restart failed for '${instanceName}': ${error.message}`);
    }
  }

  private async restorePersistedSession(instanceName: string): Promise<string> {
    let state = await this.waitForConnection(instanceName, 30_000);
    if (state === 'open') return state;

    await this.restartInstance(instanceName);
    state = await this.waitForConnection(instanceName, CONNECTION_WAIT_MS);
    return state;
  }

  private async instanceExists(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.evolutionApiUrl}/instance/fetchInstances`, {
        headers: { apikey: this.apiKey },
        timeout: WHATSAPP_TIMEOUT_MS,
      });
      const list = Array.isArray(response.data) ? response.data : [];
      return list.some(
        (item: { name?: string; instance?: { instanceName?: string } }) =>
          item.name === this.instanceName || item.instance?.instanceName === this.instanceName,
      );
    } catch {
      return false;
    }
  }

  async getConnectionState(instanceName = this.instanceName): Promise<string> {
    try {
      const response = await axios.get(
        `${this.evolutionApiUrl}/instance/connectionState/${instanceName}`,
        { headers: { apikey: this.apiKey }, timeout: WHATSAPP_TIMEOUT_MS },
      );
      return response.data?.instance?.state || response.data?.state || 'close';
    } catch {
      return 'close';
    }
  }

  async getStatus(): Promise<{ configured: boolean; instanceName: string; state: string; connected: boolean }> {
    if (!this.isConfigured()) {
      return { configured: false, instanceName: this.instanceName, state: 'not_configured', connected: false };
    }
    await this.ensureInstanceReady();
    const state = await this.getConnectionState();
    return {
      configured: true,
      instanceName: this.instanceName,
      state,
      connected: state === 'open',
    };
  }

  async createInstance(instanceName: string): Promise<any> {
    const response = await axios.post(
      `${this.evolutionApiUrl}/instance/create`,
      { instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' },
      { headers: this.headers(), timeout: WHATSAPP_TIMEOUT_MS },
    );
    return response.data;
  }

  /** Manual QR pairing only — never call this during automatic startup recovery. */
  async connectInstance(instanceName: string): Promise<any> {
    const response = await axios.get(
      `${this.evolutionApiUrl}/instance/connect/${instanceName}`,
      { headers: { apikey: this.apiKey }, timeout: WHATSAPP_TIMEOUT_MS },
    );
    return response.data;
  }

  /** Sets linked WhatsApp account profile name so chats show "MediCare" instead of raw number. */
  async syncProfileDisplayName(instanceName = this.instanceName): Promise<void> {
    if (this.profileNameSynced || !this.isConfigured()) return;

    const name = this.profileDisplayName;
    if (!name) return;

    try {
      await axios.post(
        `${this.evolutionApiUrl}/chat/updateProfileName/${instanceName}`,
        { name },
        { headers: this.headers(), timeout: WHATSAPP_TIMEOUT_MS },
      );
      this.profileNameSynced = true;
      this.logger.log(`WhatsApp profile display name set to "${name}"`);
    } catch (error: any) {
      this.logger.warn(`WhatsApp profile name sync failed: ${error.message}`);
    }
  }

  private formatNumber(phoneNumber: string): string {
    let formattedNumber = phoneNumber.replace(/[^\d]/g, '');
    if (formattedNumber.startsWith('963') && formattedNumber.length === 12) {
      return formattedNumber;
    }
    if (formattedNumber.startsWith('0') && formattedNumber.length === 10) {
      return '963' + formattedNumber.substring(1);
    }
    if (formattedNumber.length === 9) {
      return '963' + formattedNumber;
    }
    return formattedNumber;
  }

  async sendMessage(instanceName: string, phoneNumber: string, message: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('WhatsApp is not configured (EVOLUTION_API_KEY missing)');
    }

    await this.ensureInstanceReady();

    let state = await this.getConnectionState(instanceName);
    if (state !== 'open') {
      state = await this.restorePersistedSession(instanceName);
    }
    if (state !== 'open') {
      throw new Error(
        `WhatsApp is not connected (state=${state}). ` +
          'Scan the QR: GET http://localhost:3000/api/auth/dev/whatsapp-qr (development).',
      );
    }

    await this.syncProfileDisplayName(instanceName);

    const formattedNumber = this.formatNumber(phoneNumber);

    const response = await axios.post(
      `${this.evolutionApiUrl}/message/sendText/${instanceName}`,
      { number: formattedNumber, text: message },
      { headers: this.headers(), timeout: WHATSAPP_TIMEOUT_MS },
    );

    this.logger.log(`WhatsApp message sent to ${formattedNumber.substring(0, 8)}****`);
    return response.data;
  }

  async getQRCode(instanceName: string): Promise<string> {
    if (!this.isConfigured()) return '';

    await this.ensureInstanceRecord();

    const state = await this.getConnectionState(instanceName);
    if (state === 'open') return '';

    const response = await this.connectInstance(instanceName);
    const raw: string = response?.base64 || response?.qrcode?.base64 || '';
    return raw.replace(/^data:image\/png;base64,/, '');
  }

  async sendAppointmentReminder(
    phoneNumber: string, patientName: string, doctorName: string,
    appointmentDate: string, appointmentTime: string, clinicName: string,
  ): Promise<any> {
    const message = `📅 Appointment Reminder\n\nDear ${patientName},\n\nYour appointment with Dr. ${doctorName} is scheduled for:\n📅 Date: ${appointmentDate}\n⏰ Time: ${appointmentTime}\n🏥 Clinic: ${clinicName}\n\nPlease arrive 15 minutes before your appointment time.\n\nThank you!`;
    return this.sendMessage(this.instanceName, phoneNumber, message);
  }

  async sendPrescriptionReady(
    phoneNumber: string, patientName: string, doctorName: string, prescriptionId: string,
  ): Promise<any> {
    const message = `💊 Prescription Ready\n\nDear ${patientName},\n\nYour prescription from Dr. ${doctorName} is now ready.\nPrescription ID: ${prescriptionId}\n\nThank you!`;
    return this.sendMessage(this.instanceName, phoneNumber, message);
  }

  async sendTestResultsReady(
    phoneNumber: string, patientName: string, testType: string, doctorName: string,
  ): Promise<any> {
    const message = `🔬 Test Results Ready\n\nDear ${patientName},\n\nYour ${testType} test results are now available.\nReviewed by: Dr. ${doctorName}\n\nThank you!`;
    return this.sendMessage(this.instanceName, phoneNumber, message);
  }
}
