import { KafkaServiceName } from './event-envelope.types';

export interface TopicSecurityEntry {
  topic: string;
  producers: KafkaServiceName[];
  consumers: KafkaServiceName[];
  requiresTenantCorroboration: boolean;
  requiresIdempotency: boolean;
}

export const KAFKA_TOPIC_SECURITY_MATRIX: TopicSecurityEntry[] = [
  { topic: 'user.create', producers: ['auth-service', 'system-manager-service'], consumers: ['user-service'], requiresTenantCorroboration: false, requiresIdempotency: true },
  { topic: 'user.created', producers: ['user-service'], consumers: ['emr-service'], requiresTenantCorroboration: true, requiresIdempotency: true },
  { topic: 'user.password.changed', producers: ['user-service'], consumers: ['auth-service'], requiresTenantCorroboration: false, requiresIdempotency: true },
  { topic: 'user.verify.otp', producers: ['auth-service'], consumers: ['user-service'], requiresTenantCorroboration: false, requiresIdempotency: true },
  { topic: 'user.login.success', producers: ['auth-service'], consumers: [], requiresTenantCorroboration: false, requiresIdempotency: false },
  { topic: 'user.create.clinic.admin', producers: ['system-manager-service'], consumers: ['user-service'], requiresTenantCorroboration: false, requiresIdempotency: true },
  { topic: 'account.linked', producers: ['user-service'], consumers: ['system-manager-service'], requiresTenantCorroboration: false, requiresIdempotency: true },
  { topic: 'account.unlinked', producers: ['user-service'], consumers: ['system-manager-service'], requiresTenantCorroboration: false, requiresIdempotency: true },
  { topic: 'appointment.created', producers: ['appointment-service'], consumers: ['notification-service', 'reminder-service'], requiresTenantCorroboration: true, requiresIdempotency: true },
  { topic: 'appointment.updated', producers: ['appointment-service'], consumers: ['notification-service', 'reminder-service'], requiresTenantCorroboration: true, requiresIdempotency: true },
  { topic: 'appointment.cancelled', producers: ['appointment-service'], consumers: ['notification-service', 'reminder-service'], requiresTenantCorroboration: true, requiresIdempotency: true },
  { topic: 'appointment.completed', producers: ['appointment-service'], consumers: ['reminder-service'], requiresTenantCorroboration: true, requiresIdempotency: true },
  { topic: 'clinic.created', producers: ['clinic-service'], consumers: [], requiresTenantCorroboration: false, requiresIdempotency: false },
  { topic: 'clinic.updated', producers: ['clinic-service'], consumers: [], requiresTenantCorroboration: false, requiresIdempotency: false },
  { topic: 'schedule.updated', producers: ['scheduling-service'], consumers: [], requiresTenantCorroboration: false, requiresIdempotency: false },
  { topic: 'audit.log', producers: ['auth-service', 'user-service', 'appointment-service', 'emr-service', 'system-manager-service', 'clinic-service', 'scheduling-service', 'notification-service', 'reminder-service'], consumers: ['auth-service'], requiresTenantCorroboration: false, requiresIdempotency: true },
  { topic: 'system.manager.login', producers: ['system-manager-service'], consumers: [], requiresTenantCorroboration: false, requiresIdempotency: false },
  { topic: 'system.manager.created', producers: ['system-manager-service'], consumers: [], requiresTenantCorroboration: false, requiresIdempotency: false },
];

const matrixByTopic = new Map(KAFKA_TOPIC_SECURITY_MATRIX.map((e) => [e.topic, e]));

export function getTopicSecurityEntry(topic: string): TopicSecurityEntry | undefined {
  return matrixByTopic.get(topic);
}

export function isProducerAllowedForTopic(
  topic: string,
  producerService: string,
): boolean {
  const entry = getTopicSecurityEntry(topic);
  if (!entry) return false;
  return entry.producers.includes(producerService as KafkaServiceName);
}

export function topicRequiresIdempotency(topic: string): boolean {
  return getTopicSecurityEntry(topic)?.requiresIdempotency ?? false;
}

export function topicRequiresTenantCorroboration(topic: string): boolean {
  return getTopicSecurityEntry(topic)?.requiresTenantCorroboration ?? false;
}
