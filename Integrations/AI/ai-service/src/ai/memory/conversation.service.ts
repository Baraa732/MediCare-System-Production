import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiConversationThread } from '../entities/ai-conversation-thread.entity';
import { AiConversationMessage } from '../entities/ai-conversation-message.entity';
import { AiConversationSummary } from '../entities/ai-conversation-summary.entity';
import { ConsentService } from './consent.service';
import { EncryptionService } from './encryption.service';
import { IntegrityService } from './integrity.service';
import { KmsAdapterService } from './kms-adapter.service';
import {
  ConversationChannel,
  ConversationMessageRole,
  SummarySource,
} from './memory.types';
import { LanguageDetectionService } from './language-detection.service';
import { SummarizationService } from './summarization.service';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';

export interface AppendMessageInput {
  role: ConversationMessageRole;
  plaintext: string;
  detectedLang?: string;
  redactionFlags?: Record<string, unknown>;
}

export interface DecryptedMessage {
  id: string;
  threadId: string;
  seq: number;
  role: ConversationMessageRole;
  plaintext: string;
  detectedLang?: string;
  createdAt: Date;
}

export interface SaveSummaryInput {
  version: number;
  inputSeqFrom: number;
  inputSeqTo: number;
  summaryLang: string;
  summaryPromptVersion: string;
  plaintext: string;
  source: SummarySource;
  modelId?: string;
}

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(AiConversationThread)
    private readonly threadRepo: Repository<AiConversationThread>,
    @InjectRepository(AiConversationMessage)
    private readonly messageRepo: Repository<AiConversationMessage>,
    @InjectRepository(AiConversationSummary)
    private readonly summaryRepo: Repository<AiConversationSummary>,
    private readonly config: ConfigService,
    private readonly consent: ConsentService,
    private readonly kms: KmsAdapterService,
    private readonly encryption: EncryptionService,
    private readonly integrity: IntegrityService,
    private readonly languageDetection: LanguageDetectionService,
    private readonly tenantContext: TenantContextService,
    @Optional()
    @Inject(forwardRef(() => SummarizationService))
    private readonly summarization?: SummarizationService,
  ) {}

  private resolveTenantId(): string | undefined {
    return this.tenantContext.getTenantId() ?? undefined;
  }

  isStorageEnabled(): boolean {
    return this.config.get<string>('MEMORY_CONVERSATION_STORAGE') === 'true';
  }

  async getOrCreateActiveThread(
    patientId: string,
    channel: ConversationChannel,
  ): Promise<AiConversationThread> {
    const tenantId = this.resolveTenantId();
    const where: Record<string, unknown> = { patientId, channel, status: 'active' };
    if (tenantId) where.tenantId = tenantId;

    const existing = await this.threadRepo.findOne({ where });
    if (existing) {
      return existing;
    }

    const dek = this.encryption.generateDek();
    const { wrappedDek, keyVersion } = await this.kms.wrapKey(dek);

    const thread = this.threadRepo.create({
      tenantId,
      patientId,
      channel,
      status: 'active',
      messageCount: 0,
      lastActivityAt: new Date(),
      wrappedDek,
      dekKeyVersion: keyVersion,
    });

    return this.threadRepo.save(thread);
  }

  async appendMessage(
    patientId: string,
    channel: ConversationChannel,
    input: AppendMessageInput,
  ): Promise<AiConversationMessage> {
    this.assertStorageEnabled();
    await this.assertConversationConsent(patientId);

    const thread = await this.getOrCreateActiveThread(patientId, channel);
    const seq = thread.messageCount + 1;
    const detectedLang =
      input.detectedLang ?? this.languageDetection.detect(input.plaintext);
    const dek = await this.unwrapThreadDek(thread);

    const cryptoCtx = {
      threadId: thread.id,
      seq,
      keyVersion: thread.dekKeyVersion,
    };

    const encrypted = this.encryption.encryptMessage(input.plaintext, dek, cryptoCtx);
    const contentMac = this.integrity.computeMac(input.plaintext);

    const message = this.messageRepo.create({
      threadId: thread.id,
      tenantId: thread.tenantId,
      patientId,
      seq,
      role: input.role,
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      keyVersion: encrypted.keyVersion,
      contentMac,
      detectedLang,
      redactionFlags: input.redactionFlags || {},
    });

    const saved = await this.messageRepo.save(message);

    thread.messageCount = seq;
    thread.lastActivityAt = new Date();
    await this.threadRepo.save(thread);

    this.summarization?.scheduleSummaryIfNeeded(patientId, thread.id, seq);

    return saved;
  }

  async listDecryptedMessages(
    patientId: string,
    threadId: string,
  ): Promise<DecryptedMessage[]> {
    const thread = await this.requireThreadForPatient(patientId, threadId);
    const tenantId = this.resolveTenantId();
    const where: Record<string, unknown> = { patientId, threadId: thread.id };
    if (tenantId) where.tenantId = tenantId;
    const messages = await this.messageRepo.find({
      where,
      order: { seq: 'ASC' },
    });

    const dek = await this.unwrapThreadDek(thread);
    return messages.map((message) => this.decryptMessageRow(message, thread, dek));
  }

  async decryptMessage(
    patientId: string,
    messageId: string,
  ): Promise<DecryptedMessage> {
    const tenantId = this.resolveTenantId();
    const where: Record<string, unknown> = { id: messageId, patientId };
    if (tenantId) where.tenantId = tenantId;
    const message = await this.messageRepo.findOne({ where });
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const thread = await this.requireThreadForPatient(patientId, message.threadId);
    const dek = await this.unwrapThreadDek(thread);
    return this.decryptMessageRow(message, thread, dek);
  }

  /**
   * Storage-only helper for Phase 3c summarization.
   * Caller supplies already-redacted summary plaintext.
   */
  async saveSummaryRecord(
    patientId: string,
    threadId: string,
    input: SaveSummaryInput,
  ): Promise<AiConversationSummary> {
    this.assertStorageEnabled();
    if (!(await this.consent.hasConsent(patientId, 'summarization'))) {
      throw new ForbiddenException('Summarization consent required');
    }

    const thread = await this.requireThreadForPatient(patientId, threadId);
    const dek = await this.unwrapThreadDek(thread);

    const cryptoCtx = {
      threadId: thread.id,
      seq: input.inputSeqTo,
      keyVersion: thread.dekKeyVersion,
    };

    const encrypted = this.encryption.encryptMessage(input.plaintext, dek, cryptoCtx);

    const summary = this.summaryRepo.create({
      threadId: thread.id,
      tenantId: thread.tenantId,
      patientId,
      version: input.version,
      inputSeqFrom: input.inputSeqFrom,
      inputSeqTo: input.inputSeqTo,
      summaryLang: input.summaryLang,
      summaryPromptVersion: input.summaryPromptVersion,
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      keyVersion: encrypted.keyVersion,
      source: input.source,
      modelId: input.modelId,
    });

    return this.summaryRepo.save(summary);
  }

  async decryptSummaryRecord(
    patientId: string,
    summaryId: string,
  ): Promise<{ plaintext: string; summary: AiConversationSummary }> {
    const tenantId = this.resolveTenantId();
    const where: Record<string, unknown> = { id: summaryId, patientId };
    if (tenantId) where.tenantId = tenantId;
    const summary = await this.summaryRepo.findOne({ where });
    if (!summary) {
      throw new NotFoundException('Summary not found');
    }

    const thread = await this.requireThreadForPatient(patientId, summary.threadId);
    const dek = await this.unwrapThreadDek(thread);
    const cryptoCtx = {
      threadId: thread.id,
      seq: summary.inputSeqTo,
      keyVersion: summary.keyVersion,
    };

    const plaintext = this.encryption.decryptMessage(
      summary.ciphertext,
      summary.nonce,
      dek,
      cryptoCtx,
    );

    return { plaintext, summary };
  }

  private decryptMessageRow(
    message: AiConversationMessage,
    thread: AiConversationThread,
    dek: Buffer,
  ): DecryptedMessage {
    const cryptoCtx = {
      threadId: thread.id,
      seq: message.seq,
      keyVersion: message.keyVersion,
    };

    const plaintext = this.encryption.decryptMessage(
      message.ciphertext,
      message.nonce,
      dek,
      cryptoCtx,
    );

    this.integrity.verifyMac(plaintext, message.contentMac, {
      threadId: thread.id,
      seq: message.seq,
    });

    return {
      id: message.id,
      threadId: message.threadId,
      seq: message.seq,
      role: message.role,
      plaintext,
      detectedLang: message.detectedLang,
      createdAt: message.createdAt,
    };
  }

  private async requireThreadForPatient(
    patientId: string,
    threadId: string,
  ): Promise<AiConversationThread> {
    const tenantId = this.resolveTenantId();
    const where: Record<string, unknown> = { id: threadId, patientId };
    if (tenantId) where.tenantId = tenantId;

    const thread = await this.threadRepo.findOne({ where });
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }
    return thread;
  }

  private async unwrapThreadDek(thread: AiConversationThread): Promise<Buffer> {
    return this.kms.unwrapKey(thread.wrappedDek, thread.dekKeyVersion);
  }

  private assertStorageEnabled(): void {
    if (!this.isStorageEnabled()) {
      throw new ServiceUnavailableException('Conversation storage is disabled');
    }
  }

  private async assertConversationConsent(patientId: string): Promise<void> {
    if (!(await this.consent.hasConsent(patientId, 'conversation_storage'))) {
      throw new ForbiddenException('Conversation storage consent required');
    }
  }
}
