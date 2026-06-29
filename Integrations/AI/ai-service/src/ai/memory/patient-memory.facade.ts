import { Injectable, Logger } from '@nestjs/common';
import { ConsentService } from './consent.service';
import { ConversationService } from './conversation.service';
import { OutboundSanitizerService } from '../security/outbound-sanitizer.service';

const REF_TOKEN = /\b(?:CLN|DOC|SLT|APT)-[A-Z0-9]{4}\b/gi;
const UUID_ANY = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/**
 * Small facade over Phase-3 memory services for booking.
 *
 * The booking assistant is intentionally restricted:
 * - No direct DB access.
 * - No refs/UUID persistence in long-term memory.
 */
@Injectable()
export class PatientMemoryFacade {
  private readonly logger = new Logger(PatientMemoryFacade.name);

  constructor(
    private readonly consent: ConsentService,
    private readonly conversation: ConversationService,
    private readonly outboundSanitizer: OutboundSanitizerService,
  ) {}

  async loadPatientMemory(patientId: string): Promise<string> {
    if (!this.conversation.isStorageEnabled()) return '';
    if (!(await this.consent.hasConsent(patientId, 'conversation_storage'))) return '';

    try {
      const thread = await this.conversation.getOrCreateActiveThread(patientId, 'booking');
      const messages = await this.conversation.listDecryptedMessages(patientId, thread.id);
      const recent = messages.slice(-6);
      if (!recent.length) return '';
      const text = recent
        .map((m) => `[${m.role}] ${this.sanitizeForMemory(m.plaintext)}`)
        .filter((line) => !!line.trim())
        .join('\n');
      return text.trim();
    } catch (error) {
      this.logger.warn(`loadPatientMemory failed: ${(error as Error).message}`);
      return '';
    }
  }

  async recordTurn(patientId: string, userMessage: string, assistantReply: string): Promise<void> {
    if (!this.conversation.isStorageEnabled()) return;
    if (!(await this.consent.hasConsent(patientId, 'conversation_storage'))) return;

    try {
      await this.conversation.appendMessage(patientId, 'booking', {
        role: 'user',
        plaintext: this.sanitizeForMemory(userMessage),
      });
      await this.conversation.appendMessage(patientId, 'booking', {
        role: 'assistant',
        plaintext: this.sanitizeForMemory(assistantReply),
      });
    } catch (error) {
      this.logger.warn(`recordTurn failed: ${(error as Error).message}`);
    }
  }

  private sanitizeForMemory(text: string): string {
    const cleaned = this.outboundSanitizer
      .sanitizeUserResponse(text || '')
      .replace(REF_TOKEN, '[redacted-ref]')
      .replace(UUID_ANY, '[redacted-id]')
      .trim();
    return cleaned;
  }
}
