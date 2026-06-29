import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import axios from 'axios';
import { KmsConfigurationError } from './memory.errors';

export interface WrapKeyResult {
  wrappedDek: Buffer;
  keyVersion: number;
}

export type KmsProviderName = 'env' | 'vault' | 'aws';

@Injectable()
export class KmsAdapterService implements OnModuleInit {
  private readonly logger = new Logger(KmsAdapterService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const conversationStorage = this.config.get<string>('MEMORY_CONVERSATION_STORAGE') === 'true';
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const kmsKeyId = this.config.get<string>('MEMORY_KMS_KEY_ID');

    if (conversationStorage && isProduction && !kmsKeyId) {
      throw new KmsConfigurationError(
        'MEMORY_KMS_KEY_ID is required when MEMORY_CONVERSATION_STORAGE=true in production',
      );
    }
  }

  async wrapKey(dek: Buffer): Promise<WrapKeyResult> {
    const provider = this.resolveProvider();
    const keyVersion = this.getActiveKeyVersion();

    switch (provider) {
      case 'env':
        return { wrappedDek: this.wrapWithEnvKek(dek, keyVersion), keyVersion };
      case 'vault':
        return { wrappedDek: await this.wrapWithVault(dek), keyVersion };
      case 'aws':
        return { wrappedDek: await this.wrapWithAws(dek), keyVersion };
      default:
        throw new KmsConfigurationError(`Unsupported KMS provider: ${provider}`);
    }
  }

  async unwrapKey(wrappedDek: Buffer, keyVersion: number): Promise<Buffer> {
    const provider = this.resolveProvider();

    switch (provider) {
      case 'env':
        return this.unwrapWithEnvKek(wrappedDek, keyVersion);
      case 'vault':
        return this.unwrapWithVault(wrappedDek);
      case 'aws':
        return this.unwrapWithAws(wrappedDek);
      default:
        throw new KmsConfigurationError(`Unsupported KMS provider: ${provider}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const provider = this.resolveProvider();
      switch (provider) {
        case 'env':
          this.getEnvKek();
          return true;
        case 'vault':
          return await this.vaultHealthCheck();
        case 'aws':
          return await this.awsHealthCheck();
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  resolveProvider(): KmsProviderName {
    const explicit = this.config.get<string>('MEMORY_KMS_PROVIDER')?.toLowerCase();
    if (explicit === 'env' || explicit === 'vault' || explicit === 'aws') {
      return explicit;
    }

    const kmsKeyId = this.config.get<string>('MEMORY_KMS_KEY_ID');
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';

    if (!kmsKeyId || !isProduction) {
      return 'env';
    }

    const vaultAddr = this.config.get<string>('MEMORY_VAULT_ADDR');
    if (vaultAddr) {
      return 'vault';
    }

    return 'aws';
  }

  getActiveKeyVersion(): number {
    const version = Number(this.config.get<string>('MEMORY_KEK_VERSION') || '1');
    return Number.isFinite(version) && version > 0 ? version : 1;
  }

  private wrapWithEnvKek(dek: Buffer, keyVersion: number): Buffer {
    const kek = this.getEnvKek();
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', kek, nonce);
    const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();
    const versionBuf = Buffer.alloc(2);
    versionBuf.writeUInt16BE(keyVersion, 0);
    return Buffer.concat([Buffer.from('ENV1'), versionBuf, nonce, tag, encrypted]);
  }

  private unwrapWithEnvKek(wrappedDek: Buffer, keyVersion: number): Buffer {
    const prefix = wrappedDek.subarray(0, 4).toString('utf8');
    if (prefix !== 'ENV1') {
      throw new KmsConfigurationError('Invalid env-wrapped DEK prefix');
    }
    const embeddedVersion = wrappedDek.readUInt16BE(4);
    if (embeddedVersion !== keyVersion) {
      throw new KmsConfigurationError('DEK key version mismatch');
    }
    const kek = this.getEnvKekForVersion(keyVersion);
    const nonce = wrappedDek.subarray(6, 18);
    const tag = wrappedDek.subarray(18, 34);
    const encrypted = wrappedDek.subarray(34);
    const decipher = createDecipheriv('aes-256-gcm', kek, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  private getEnvKek(): Buffer {
    return this.getEnvKekForVersion(this.getActiveKeyVersion());
  }

  private getEnvKekForVersion(version: number): Buffer {
    const primary = this.config.get<string>('MEMORY_KEK');
    const previous = this.config.get<string>('MEMORY_KEK_PREVIOUS');

    const material =
      version === this.getActiveKeyVersion()
        ? primary
        : version === this.getActiveKeyVersion() - 1
          ? previous || primary
          : primary;

    if (!material) {
      throw new KmsConfigurationError('MEMORY_KEK is not configured');
    }

    const key = Buffer.from(material, 'base64');
    if (key.length !== 32) {
      throw new KmsConfigurationError('MEMORY_KEK must be a base64-encoded 32-byte key');
    }
    return key;
  }

  private async wrapWithVault(dek: Buffer): Promise<Buffer> {
    const keyName = this.requireKmsKeyId();
    const addr = this.config.getOrThrow<string>('MEMORY_VAULT_ADDR');
    const token = this.config.getOrThrow<string>('MEMORY_VAULT_TOKEN');

    const response = await axios.post(
      `${addr.replace(/\/$/, '')}/v1/transit/encrypt/${encodeURIComponent(keyName)}`,
      { plaintext: dek.toString('base64') },
      { headers: { 'X-Vault-Token': token }, timeout: 5000 },
    );

    const ciphertext = response.data?.data?.ciphertext;
    if (!ciphertext) {
      throw new KmsConfigurationError('Vault encrypt returned no ciphertext');
    }
    return Buffer.from(String(ciphertext), 'utf8');
  }

  private async unwrapWithVault(wrappedDek: Buffer): Promise<Buffer> {
    const keyName = this.requireKmsKeyId();
    const addr = this.config.getOrThrow<string>('MEMORY_VAULT_ADDR');
    const token = this.config.getOrThrow<string>('MEMORY_VAULT_TOKEN');

    const response = await axios.post(
      `${addr.replace(/\/$/, '')}/v1/transit/decrypt/${encodeURIComponent(keyName)}`,
      { ciphertext: wrappedDek.toString('utf8') },
      { headers: { 'X-Vault-Token': token }, timeout: 5000 },
    );

    const plaintext = response.data?.data?.plaintext;
    if (!plaintext) {
      throw new KmsConfigurationError('Vault decrypt returned no plaintext');
    }
    return Buffer.from(String(plaintext), 'base64');
  }

  private async vaultHealthCheck(): Promise<boolean> {
    const addr = this.config.get<string>('MEMORY_VAULT_ADDR');
    const token = this.config.get<string>('MEMORY_VAULT_TOKEN');
    if (!addr || !token) return false;
    const response = await axios.get(`${addr.replace(/\/$/, '')}/v1/sys/health`, {
      timeout: 3000,
      validateStatus: () => true,
    });
    return response.status === 200 || response.status === 429;
  }

  private async wrapWithAws(dek: Buffer): Promise<Buffer> {
    const keyId = this.requireKmsKeyId();
    const { KMSClient, EncryptCommand } = await import('@aws-sdk/client-kms');
    const client = new KMSClient({});
    const result = await client.send(
      new EncryptCommand({
        KeyId: keyId,
        Plaintext: dek,
      }),
    );
    if (!result.CiphertextBlob) {
      throw new KmsConfigurationError('AWS KMS encrypt returned no ciphertext');
    }
    return Buffer.from(result.CiphertextBlob);
  }

  private async unwrapWithAws(wrappedDek: Buffer): Promise<Buffer> {
    const { KMSClient, DecryptCommand } = await import('@aws-sdk/client-kms');
    const client = new KMSClient({});
    const result = await client.send(
      new DecryptCommand({
        CiphertextBlob: wrappedDek,
      }),
    );
    if (!result.Plaintext) {
      throw new KmsConfigurationError('AWS KMS decrypt returned no plaintext');
    }
    return Buffer.from(result.Plaintext);
  }

  private async awsHealthCheck(): Promise<boolean> {
    const keyId = this.config.get<string>('MEMORY_KMS_KEY_ID');
    if (!keyId) return false;
    try {
      const { KMSClient, DescribeKeyCommand } = await import('@aws-sdk/client-kms');
      const client = new KMSClient({});
      const result = await client.send(new DescribeKeyCommand({ KeyId: keyId }));
      return result.KeyMetadata?.Enabled === true;
    } catch (error) {
      this.logger.warn(`AWS KMS health check failed: ${(error as Error).message}`);
      return false;
    }
  }

  private requireKmsKeyId(): string {
    const keyId = this.config.get<string>('MEMORY_KMS_KEY_ID');
    if (!keyId) {
      throw new KmsConfigurationError('MEMORY_KMS_KEY_ID is required for vault/aws KMS providers');
    }
    return keyId;
  }
}
