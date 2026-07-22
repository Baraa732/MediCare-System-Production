import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  ACTIVATION_DOCUMENT_FIELDS,
  REQUIRED_ACTIVATION_DOCUMENTS,
  type ActivationDocumentField,
} from '../enums/clinic-activation.enums';
import type {
  ActivationDocumentRef,
  ActivationDocumentsMap,
  ActivationUploadedFiles,
  UploadedActivationFile,
} from '../types/activation-documents.types';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MAX_FILE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class ActivationDocumentService {
  private readonly logger = new Logger(ActivationDocumentService.name);
  private readonly uploadRoot =
    process.env.ACTIVATION_DOCUMENTS_DIR ||
    path.join(process.cwd(), 'uploads', 'activation-documents');

  ensureUploadRoot(): void {
    fs.mkdirSync(this.uploadRoot, { recursive: true });
  }

  validateRequiredFiles(files: ActivationUploadedFiles | undefined): void {
    if (!files) {
      throw new BadRequestException('Verification documents are required for activation provisioning.');
    }

    for (const field of REQUIRED_ACTIVATION_DOCUMENTS) {
      const file = files[field];
      if (!file) {
        throw new BadRequestException(`Missing required document: ${field}`);
      }
      this.validateFile(file, field);
    }

    for (const field of ACTIVATION_DOCUMENT_FIELDS) {
      const file = files[field];
      if (file) this.validateFile(file, field);
    }
  }

  async persistDocuments(
    activationId: string,
    files: ActivationUploadedFiles,
  ): Promise<ActivationDocumentsMap> {
    this.ensureUploadRoot();
    const activationDir = path.join(this.uploadRoot, activationId);
    fs.mkdirSync(activationDir, { recursive: true });

    const documents: ActivationDocumentsMap = {};

    for (const field of ACTIVATION_DOCUMENT_FIELDS) {
      const file = files[field];
      if (!file) continue;

      const ext = this.extensionForMime(file.mimetype, file.originalname);
      const storageKey = `${field}-${randomUUID()}${ext}`;
      const absolutePath = path.join(activationDir, storageKey);

      await fs.promises.writeFile(absolutePath, file.buffer);

      documents[field] = {
        fileName: file.originalname,
        mimeType: file.mimetype,
        storageKey,
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
      };

      this.logger.log(`Stored activation document ${field} for ${activationId}`);
    }

    return documents;
  }

  resolveAbsolutePath(activationId: string, storageKey: string): string {
    const activationDir = path.join(this.uploadRoot, activationId);
    const absolutePath = path.join(activationDir, storageKey);
    if (!absolutePath.startsWith(activationDir)) {
      throw new BadRequestException('Invalid document path');
    }
    return absolutePath;
  }

  async readDocument(activationId: string, storageKey: string): Promise<Buffer> {
    const absolutePath = this.resolveAbsolutePath(activationId, storageKey);
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('Document not found');
    }
    return fs.promises.readFile(absolutePath);
  }

  private validateFile(file: UploadedActivationFile, field: ActivationDocumentField): void {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `${field}: only JPEG, PNG, WebP images and PDF files are allowed`,
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException(`${field}: file exceeds 10 MB limit`);
    }
  }

  private extensionForMime(mimeType: string, originalName: string): string {
    if (mimeType === 'application/pdf') return '.pdf';
    if (mimeType === 'image/png') return '.png';
    if (mimeType === 'image/webp') return '.webp';
    const fromName = path.extname(originalName);
    if (fromName) return fromName.toLowerCase();
    return '.jpg';
  }
}
