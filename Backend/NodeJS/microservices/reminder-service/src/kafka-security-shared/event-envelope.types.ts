export interface KafkaEventEnvelope<T = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  producerService: string;
  timestamp: string;
  payload: T;
  signature: string;
}

export type KafkaServiceName =
  | 'auth-service'
  | 'user-service'
  | 'appointment-service'
  | 'clinic-service'
  | 'scheduling-service'
  | 'notification-service'
  | 'reminder-service'
  | 'system-manager-service'
  | 'emr-service'
  | 'api-gateway';

export interface VerifiedKafkaEvent<T = Record<string, unknown>> {
  envelope: KafkaEventEnvelope<T>;
  tenantId?: string;
}
