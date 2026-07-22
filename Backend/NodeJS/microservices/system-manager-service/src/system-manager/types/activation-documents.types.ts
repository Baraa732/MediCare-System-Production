import type { ActivationDocumentField } from '../enums/clinic-activation.enums';

export type UploadedActivationFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export type ActivationDocumentRef = {
  fileName: string;
  mimeType: string;
  storageKey: string;
  sizeBytes: number;
  uploadedAt: string;
};

export type ActivationDocumentsMap = Partial<Record<ActivationDocumentField, ActivationDocumentRef>>;

export type ActivationUploadedFiles = Partial<
  Record<ActivationDocumentField, UploadedActivationFile>
>;
