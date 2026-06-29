export class IntegrityMacFailedError extends Error {
  constructor(message = 'integrity.mac_failed') {
    super(message);
    this.name = 'IntegrityMacFailedError';
  }
}

export class EncryptionFailedError extends Error {
  constructor(message = 'encryption_failed') {
    super(message);
    this.name = 'EncryptionFailedError';
  }
}

export class KmsConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KmsConfigurationError';
  }
}

export interface IntegrityMacFailedEvent {
  reason: 'integrity.mac_failed';
  threadId?: string;
  seq?: number;
}
