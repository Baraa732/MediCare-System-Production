import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { EncryptionFailedError } from './memory.errors';

export interface MessageCryptoContext {
  threadId: string;
  seq: number;
  keyVersion: number;
}

export interface EncryptedMessagePayload {
  ciphertext: Buffer;
  nonce: Buffer;
  keyVersion: number;
}

@Injectable()
export class EncryptionService {
  private static readonly NONCE_BYTES = 12;
  private static readonly DEK_BYTES = 32;

  generateDek(): Buffer {
    return randomBytes(EncryptionService.DEK_BYTES);
  }

  buildAad(ctx: MessageCryptoContext): Buffer {
    const aadText = `${ctx.threadId}:${ctx.seq}:${ctx.keyVersion}`;
    return Buffer.from(aadText, 'utf8');
  }

  encryptMessage(plaintext: string, dek: Buffer, ctx: MessageCryptoContext): EncryptedMessagePayload {
    if (dek.length !== EncryptionService.DEK_BYTES) {
      throw new EncryptionFailedError('DEK must be 32 bytes');
    }

    const nonce = randomBytes(EncryptionService.NONCE_BYTES);
    const aad = this.buildAad(ctx);
    const cipher = createCipheriv('aes-256-gcm', dek, nonce);
    cipher.setAAD(aad);

    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(plaintext, 'utf8')),
      cipher.final(),
      cipher.getAuthTag(),
    ]);

    return {
      ciphertext,
      nonce,
      keyVersion: ctx.keyVersion,
    };
  }

  decryptMessage(
    ciphertext: Buffer,
    nonce: Buffer,
    dek: Buffer,
    ctx: MessageCryptoContext,
  ): string {
    if (dek.length !== EncryptionService.DEK_BYTES) {
      throw new EncryptionFailedError('DEK must be 32 bytes');
    }
    if (nonce.length !== EncryptionService.NONCE_BYTES) {
      throw new EncryptionFailedError('Nonce must be 12 bytes');
    }
    if (ciphertext.length < 16) {
      throw new EncryptionFailedError('Ciphertext too short');
    }

    const tag = ciphertext.subarray(ciphertext.length - 16);
    const encrypted = ciphertext.subarray(0, ciphertext.length - 16);
    const aad = this.buildAad(ctx);
    const decipher = createDecipheriv('aes-256-gcm', dek, nonce);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);

    try {
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch {
      throw new EncryptionFailedError('AES-GCM decryption failed — AAD or ciphertext mismatch');
    }
  }
}
