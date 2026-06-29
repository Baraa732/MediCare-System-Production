export enum KafkaTopics {
  // User Events
  USER_CREATE                              = 'user.create',
  USER_CREATE_REPLY                        = 'user.create.reply',
  USER_CREATED                             = 'user.created',
  USER_UPDATED                             = 'user.updated',
  USER_DELETED                             = 'user.deleted',
  USER_STATUS_UPDATED                      = 'user.status.updated',
  USER_PHONE_VERIFIED                      = 'user.phone.verified',
  USER_EMAIL_VERIFIED                      = 'user.email.verified',
  USER_PASSWORD_CHANGED                    = 'user.password.changed',

  // Auth Events
  USER_LOGIN_REQUEST                       = 'user.login.request',
  USER_LOGIN_REQUEST_REPLY                 = 'user.login.request.reply',
  USER_LOGIN_SUCCESS                       = 'user.login.success',
  USER_VERIFY_OTP                          = 'user.verify.otp',

  // Account Linking Events
  ACCOUNT_LINKED                           = 'account.linked',
  ACCOUNT_UNLINKED                         = 'account.unlinked',
  USER_LINK_PATIENT_ACCOUNT                = 'user.link.patient.account',
  USER_LINK_PATIENT_ACCOUNT_REPLY          = 'user.link.patient.account.reply',
  USER_GET_LINKED_ACCOUNTS                 = 'user.get.linked.accounts',
  USER_GET_LINKED_ACCOUNTS_REPLY           = 'user.get.linked.accounts.reply',
  USER_UNLINK_ACCOUNT                      = 'user.unlink.account',
  USER_UNLINK_ACCOUNT_REPLY                = 'user.unlink.account.reply',

  // Clinic Admin Events
  USER_CREATE_CLINIC_ADMIN_PENDING         = 'user.create.clinic.admin.pending',
  USER_CREATE_CLINIC_ADMIN                 = 'user.create.clinic.admin',
  CLINIC_ADMIN_ACTIVATE                    = 'clinic.admin.activate',
  SYSTEM_MANAGER_ACTIVATE_CLINIC_ADMIN     = 'system.manager.activate.clinic.admin',
  SYSTEM_MANAGER_ACTIVATE_CLINIC_ADMIN_REPLY = 'system.manager.activate.clinic.admin.reply',
  USER_DASHBOARD_ACTIVATION_UPDATED        = 'user.dashboard.activation.updated',

  // System Manager Events
  SYSTEM_MANAGER_LOGIN                     = 'system.manager.login',
  SYSTEM_MANAGER_CREATED                   = 'system.manager.created',
  USER_CREATE_BY_ADMIN                     = 'user.create.by.admin',
  USER_CREATE_BY_ADMIN_REPLY               = 'user.create.by.admin.reply',
  USER_CHECK_EXISTS                        = 'user.check.exists',
  USER_CHECK_EXISTS_REPLY                  = 'user.check.exists.reply',

  // Clinic Events
  CLINIC_CREATED                           = 'clinic.created',
  CLINIC_UPDATED                           = 'clinic.updated',
  CLINIC_DELETED                           = 'clinic.deleted',
  CLINIC_STAFF_ASSIGNED                    = 'clinic.staff.assigned',
  CLINIC_STAFF_REMOVED                     = 'clinic.staff.removed',

  // Appointment Events
  APPOINTMENT_CREATED                      = 'appointment.created',
  APPOINTMENT_UPDATED                      = 'appointment.updated',
  APPOINTMENT_CANCELLED                    = 'appointment.cancelled',
  APPOINTMENT_COMPLETED                    = 'appointment.completed',

  // Schedule Events
  SCHEDULE_UPDATED                         = 'schedule.updated',

  // Notification Events
  NOTIFICATION_SENT                        = 'notification.sent',
  NOTIFICATION_FAILED                      = 'notification.failed',
  REMINDER_SCHEDULED                       = 'reminder.scheduled',
  REMINDER_SENT                            = 'reminder.sent',
  REMINDER_FAILED                          = 'reminder.failed',

  // Audit Log Events
  AUDIT_LOG                                = 'audit.log',

  // Dead Letter Topics (DLT)
  ACCOUNT_LINKED_DLT                       = 'account.linked.dlt',
  ACCOUNT_UNLINKED_DLT                     = 'account.unlinked.dlt',
  USER_CREATE_CLINIC_ADMIN_PENDING_DLT     = 'user.create.clinic.admin.pending.dlt',
  CLINIC_ADMIN_ACTIVATE_DLT                = 'clinic.admin.activate.dlt',
  USER_CREATE_DLT                          = 'user.create.dlt',
  USER_VERIFY_OTP_DLT                      = 'user.verify.otp.dlt',
  USER_LOGIN_REQUEST_DLT                   = 'user.login.request.dlt',
  USER_CHECK_EXISTS_DLT                    = 'user.check.exists.dlt',
  USER_LINK_PATIENT_ACCOUNT_DLT            = 'user.link.patient.account.dlt',
  USER_UNLINK_ACCOUNT_DLT                  = 'user.unlink.account.dlt',
  USER_GET_LINKED_ACCOUNTS_DLT             = 'user.get.linked.accounts.dlt',
  USER_CREATE_BY_ADMIN_DLT                 = 'user.create.by.admin.dlt',
  USER_CREATED_DLT                         = 'user.created.dlt',
}

export interface TopicConfig {
  name: string;
  partitions: number;
  replicationFactor: number;
  config?: Record<string, string>;
}

const SEVEN_DAYS_MS = String(7 * 24 * 60 * 60 * 1000);
const THIRTY_DAYS_MS = String(30 * 24 * 60 * 60 * 1000);

// Production / multi-broker cluster defaults
const STANDARD_CONFIG: Record<string, string> = {
  'min.insync.replicas': '2',
  'retention.ms': SEVEN_DAYS_MS,
};

const DLT_CONFIG: Record<string, string> = {
  'min.insync.replicas': '2',
  'retention.ms': THIRTY_DAYS_MS,
};

const t = (name: KafkaTopics, partitions = 3): TopicConfig => ({
  name,
  partitions,
  replicationFactor: 3,
  config: STANDARD_CONFIG,
});

const dlt = (name: KafkaTopics): TopicConfig => ({
  name,
  partitions: 1,
  replicationFactor: 3,
  config: DLT_CONFIG,
});

/** Single-broker docker-compose (RF=1, no min.insync.replicas). */
const devT = (name: KafkaTopics, partitions = 3): TopicConfig => ({
  name,
  partitions,
  replicationFactor: 1,
  config: { 'retention.ms': SEVEN_DAYS_MS },
});

const devDlt = (name: KafkaTopics): TopicConfig => ({
  name,
  partitions: 1,
  replicationFactor: 1,
  config: { 'retention.ms': THIRTY_DAYS_MS },
});

export const TopicConfigurations: Record<KafkaTopics, TopicConfig> = {
  [KafkaTopics.USER_CREATE]:                              t(KafkaTopics.USER_CREATE),
  [KafkaTopics.USER_CREATE_REPLY]:                        t(KafkaTopics.USER_CREATE_REPLY),
  [KafkaTopics.USER_CREATED]:                             t(KafkaTopics.USER_CREATED),
  [KafkaTopics.USER_UPDATED]:                             t(KafkaTopics.USER_UPDATED),
  [KafkaTopics.USER_DELETED]:                             t(KafkaTopics.USER_DELETED),
  [KafkaTopics.USER_STATUS_UPDATED]:                      t(KafkaTopics.USER_STATUS_UPDATED),
  [KafkaTopics.USER_PHONE_VERIFIED]:                      t(KafkaTopics.USER_PHONE_VERIFIED),
  [KafkaTopics.USER_EMAIL_VERIFIED]:                      t(KafkaTopics.USER_EMAIL_VERIFIED),
  [KafkaTopics.USER_PASSWORD_CHANGED]:                    t(KafkaTopics.USER_PASSWORD_CHANGED),
  [KafkaTopics.USER_LOGIN_REQUEST]:                       t(KafkaTopics.USER_LOGIN_REQUEST),
  [KafkaTopics.USER_LOGIN_REQUEST_REPLY]:                 t(KafkaTopics.USER_LOGIN_REQUEST_REPLY),
  [KafkaTopics.USER_LOGIN_SUCCESS]:                       t(KafkaTopics.USER_LOGIN_SUCCESS),
  [KafkaTopics.USER_VERIFY_OTP]:                          t(KafkaTopics.USER_VERIFY_OTP),
  [KafkaTopics.ACCOUNT_LINKED]:                           t(KafkaTopics.ACCOUNT_LINKED),
  [KafkaTopics.ACCOUNT_UNLINKED]:                         t(KafkaTopics.ACCOUNT_UNLINKED),
  [KafkaTopics.USER_LINK_PATIENT_ACCOUNT]:                t(KafkaTopics.USER_LINK_PATIENT_ACCOUNT),
  [KafkaTopics.USER_LINK_PATIENT_ACCOUNT_REPLY]:          t(KafkaTopics.USER_LINK_PATIENT_ACCOUNT_REPLY),
  [KafkaTopics.USER_GET_LINKED_ACCOUNTS]:                 t(KafkaTopics.USER_GET_LINKED_ACCOUNTS),
  [KafkaTopics.USER_GET_LINKED_ACCOUNTS_REPLY]:           t(KafkaTopics.USER_GET_LINKED_ACCOUNTS_REPLY),
  [KafkaTopics.USER_UNLINK_ACCOUNT]:                      t(KafkaTopics.USER_UNLINK_ACCOUNT),
  [KafkaTopics.USER_UNLINK_ACCOUNT_REPLY]:                t(KafkaTopics.USER_UNLINK_ACCOUNT_REPLY),
  [KafkaTopics.USER_CREATE_CLINIC_ADMIN_PENDING]:         t(KafkaTopics.USER_CREATE_CLINIC_ADMIN_PENDING),
  [KafkaTopics.USER_CREATE_CLINIC_ADMIN]:                 t(KafkaTopics.USER_CREATE_CLINIC_ADMIN),
  [KafkaTopics.CLINIC_ADMIN_ACTIVATE]:                    t(KafkaTopics.CLINIC_ADMIN_ACTIVATE),
  [KafkaTopics.SYSTEM_MANAGER_ACTIVATE_CLINIC_ADMIN]:     t(KafkaTopics.SYSTEM_MANAGER_ACTIVATE_CLINIC_ADMIN),
  [KafkaTopics.SYSTEM_MANAGER_ACTIVATE_CLINIC_ADMIN_REPLY]: t(KafkaTopics.SYSTEM_MANAGER_ACTIVATE_CLINIC_ADMIN_REPLY),
  [KafkaTopics.USER_DASHBOARD_ACTIVATION_UPDATED]:        t(KafkaTopics.USER_DASHBOARD_ACTIVATION_UPDATED),
  [KafkaTopics.SYSTEM_MANAGER_LOGIN]:                     t(KafkaTopics.SYSTEM_MANAGER_LOGIN, 1),
  [KafkaTopics.SYSTEM_MANAGER_CREATED]:                   t(KafkaTopics.SYSTEM_MANAGER_CREATED, 1),
  [KafkaTopics.USER_CREATE_BY_ADMIN]:                     t(KafkaTopics.USER_CREATE_BY_ADMIN),
  [KafkaTopics.USER_CREATE_BY_ADMIN_REPLY]:               t(KafkaTopics.USER_CREATE_BY_ADMIN_REPLY),
  [KafkaTopics.USER_CHECK_EXISTS]:                        t(KafkaTopics.USER_CHECK_EXISTS),
  [KafkaTopics.USER_CHECK_EXISTS_REPLY]:                  t(KafkaTopics.USER_CHECK_EXISTS_REPLY),
  [KafkaTopics.CLINIC_CREATED]:                           t(KafkaTopics.CLINIC_CREATED),
  [KafkaTopics.CLINIC_UPDATED]:                           t(KafkaTopics.CLINIC_UPDATED),
  [KafkaTopics.CLINIC_DELETED]:                           t(KafkaTopics.CLINIC_DELETED),
  [KafkaTopics.CLINIC_STAFF_ASSIGNED]:                    t(KafkaTopics.CLINIC_STAFF_ASSIGNED),
  [KafkaTopics.CLINIC_STAFF_REMOVED]:                     t(KafkaTopics.CLINIC_STAFF_REMOVED),
  [KafkaTopics.APPOINTMENT_CREATED]:                      t(KafkaTopics.APPOINTMENT_CREATED),
  [KafkaTopics.APPOINTMENT_UPDATED]:                      t(KafkaTopics.APPOINTMENT_UPDATED),
  [KafkaTopics.APPOINTMENT_CANCELLED]:                    t(KafkaTopics.APPOINTMENT_CANCELLED),
  [KafkaTopics.APPOINTMENT_COMPLETED]:                    t(KafkaTopics.APPOINTMENT_COMPLETED),
  [KafkaTopics.SCHEDULE_UPDATED]:                         t(KafkaTopics.SCHEDULE_UPDATED),
  [KafkaTopics.NOTIFICATION_SENT]:                        t(KafkaTopics.NOTIFICATION_SENT),
  [KafkaTopics.NOTIFICATION_FAILED]:                      t(KafkaTopics.NOTIFICATION_FAILED),
  [KafkaTopics.REMINDER_SCHEDULED]:                       t(KafkaTopics.REMINDER_SCHEDULED),
  [KafkaTopics.REMINDER_SENT]:                            t(KafkaTopics.REMINDER_SENT),
  [KafkaTopics.REMINDER_FAILED]:                          t(KafkaTopics.REMINDER_FAILED),
  [KafkaTopics.AUDIT_LOG]:                                t(KafkaTopics.AUDIT_LOG),
  [KafkaTopics.ACCOUNT_LINKED_DLT]:                       dlt(KafkaTopics.ACCOUNT_LINKED_DLT),
  [KafkaTopics.ACCOUNT_UNLINKED_DLT]:                     dlt(KafkaTopics.ACCOUNT_UNLINKED_DLT),
  [KafkaTopics.USER_CREATE_CLINIC_ADMIN_PENDING_DLT]:     dlt(KafkaTopics.USER_CREATE_CLINIC_ADMIN_PENDING_DLT),
  [KafkaTopics.CLINIC_ADMIN_ACTIVATE_DLT]:                dlt(KafkaTopics.CLINIC_ADMIN_ACTIVATE_DLT),
  [KafkaTopics.USER_CREATE_DLT]:                          dlt(KafkaTopics.USER_CREATE_DLT),
  [KafkaTopics.USER_VERIFY_OTP_DLT]:                      dlt(KafkaTopics.USER_VERIFY_OTP_DLT),
  [KafkaTopics.USER_LOGIN_REQUEST_DLT]:                   dlt(KafkaTopics.USER_LOGIN_REQUEST_DLT),
  [KafkaTopics.USER_CHECK_EXISTS_DLT]:                    dlt(KafkaTopics.USER_CHECK_EXISTS_DLT),
  [KafkaTopics.USER_LINK_PATIENT_ACCOUNT_DLT]:            dlt(KafkaTopics.USER_LINK_PATIENT_ACCOUNT_DLT),
  [KafkaTopics.USER_UNLINK_ACCOUNT_DLT]:                  dlt(KafkaTopics.USER_UNLINK_ACCOUNT_DLT),
  [KafkaTopics.USER_GET_LINKED_ACCOUNTS_DLT]:             dlt(KafkaTopics.USER_GET_LINKED_ACCOUNTS_DLT),
  [KafkaTopics.USER_CREATE_BY_ADMIN_DLT]:                 dlt(KafkaTopics.USER_CREATE_BY_ADMIN_DLT),
  [KafkaTopics.USER_CREATED_DLT]:                         dlt(KafkaTopics.USER_CREATED_DLT),
};

/** Topics created by docker-compose kafka-init (single broker). */
export const DockerComposeTopicConfigurations: Record<KafkaTopics, TopicConfig> = {
  [KafkaTopics.USER_CREATE]:                              devT(KafkaTopics.USER_CREATE),
  [KafkaTopics.USER_CREATE_REPLY]:                        devT(KafkaTopics.USER_CREATE_REPLY),
  [KafkaTopics.USER_CREATED]:                             devT(KafkaTopics.USER_CREATED),
  [KafkaTopics.USER_UPDATED]:                             devT(KafkaTopics.USER_UPDATED),
  [KafkaTopics.USER_DELETED]:                             devT(KafkaTopics.USER_DELETED),
  [KafkaTopics.USER_STATUS_UPDATED]:                      devT(KafkaTopics.USER_STATUS_UPDATED),
  [KafkaTopics.USER_PHONE_VERIFIED]:                      devT(KafkaTopics.USER_PHONE_VERIFIED),
  [KafkaTopics.USER_EMAIL_VERIFIED]:                      devT(KafkaTopics.USER_EMAIL_VERIFIED),
  [KafkaTopics.USER_PASSWORD_CHANGED]:                    devT(KafkaTopics.USER_PASSWORD_CHANGED),
  [KafkaTopics.USER_LOGIN_REQUEST]:                       devT(KafkaTopics.USER_LOGIN_REQUEST),
  [KafkaTopics.USER_LOGIN_REQUEST_REPLY]:                 devT(KafkaTopics.USER_LOGIN_REQUEST_REPLY),
  [KafkaTopics.USER_LOGIN_SUCCESS]:                       devT(KafkaTopics.USER_LOGIN_SUCCESS),
  [KafkaTopics.USER_VERIFY_OTP]:                          devT(KafkaTopics.USER_VERIFY_OTP),
  [KafkaTopics.ACCOUNT_LINKED]:                           devT(KafkaTopics.ACCOUNT_LINKED),
  [KafkaTopics.ACCOUNT_UNLINKED]:                         devT(KafkaTopics.ACCOUNT_UNLINKED),
  [KafkaTopics.USER_LINK_PATIENT_ACCOUNT]:                devT(KafkaTopics.USER_LINK_PATIENT_ACCOUNT),
  [KafkaTopics.USER_LINK_PATIENT_ACCOUNT_REPLY]:          devT(KafkaTopics.USER_LINK_PATIENT_ACCOUNT_REPLY),
  [KafkaTopics.USER_GET_LINKED_ACCOUNTS]:                 devT(KafkaTopics.USER_GET_LINKED_ACCOUNTS),
  [KafkaTopics.USER_GET_LINKED_ACCOUNTS_REPLY]:           devT(KafkaTopics.USER_GET_LINKED_ACCOUNTS_REPLY),
  [KafkaTopics.USER_UNLINK_ACCOUNT]:                      devT(KafkaTopics.USER_UNLINK_ACCOUNT),
  [KafkaTopics.USER_UNLINK_ACCOUNT_REPLY]:                devT(KafkaTopics.USER_UNLINK_ACCOUNT_REPLY),
  [KafkaTopics.USER_CREATE_CLINIC_ADMIN_PENDING]:         devT(KafkaTopics.USER_CREATE_CLINIC_ADMIN_PENDING),
  [KafkaTopics.USER_CREATE_CLINIC_ADMIN]:                 devT(KafkaTopics.USER_CREATE_CLINIC_ADMIN),
  [KafkaTopics.CLINIC_ADMIN_ACTIVATE]:                    devT(KafkaTopics.CLINIC_ADMIN_ACTIVATE),
  [KafkaTopics.SYSTEM_MANAGER_ACTIVATE_CLINIC_ADMIN]:     devT(KafkaTopics.SYSTEM_MANAGER_ACTIVATE_CLINIC_ADMIN),
  [KafkaTopics.SYSTEM_MANAGER_ACTIVATE_CLINIC_ADMIN_REPLY]: devT(KafkaTopics.SYSTEM_MANAGER_ACTIVATE_CLINIC_ADMIN_REPLY),
  [KafkaTopics.USER_DASHBOARD_ACTIVATION_UPDATED]:        devT(KafkaTopics.USER_DASHBOARD_ACTIVATION_UPDATED),
  [KafkaTopics.SYSTEM_MANAGER_LOGIN]:                     devT(KafkaTopics.SYSTEM_MANAGER_LOGIN, 1),
  [KafkaTopics.SYSTEM_MANAGER_CREATED]:                   devT(KafkaTopics.SYSTEM_MANAGER_CREATED, 1),
  [KafkaTopics.USER_CREATE_BY_ADMIN]:                     devT(KafkaTopics.USER_CREATE_BY_ADMIN),
  [KafkaTopics.USER_CREATE_BY_ADMIN_REPLY]:               devT(KafkaTopics.USER_CREATE_BY_ADMIN_REPLY),
  [KafkaTopics.USER_CHECK_EXISTS]:                        devT(KafkaTopics.USER_CHECK_EXISTS),
  [KafkaTopics.USER_CHECK_EXISTS_REPLY]:                  devT(KafkaTopics.USER_CHECK_EXISTS_REPLY),
  [KafkaTopics.CLINIC_CREATED]:                           devT(KafkaTopics.CLINIC_CREATED),
  [KafkaTopics.CLINIC_UPDATED]:                           devT(KafkaTopics.CLINIC_UPDATED),
  [KafkaTopics.CLINIC_DELETED]:                           devT(KafkaTopics.CLINIC_DELETED),
  [KafkaTopics.CLINIC_STAFF_ASSIGNED]:                    devT(KafkaTopics.CLINIC_STAFF_ASSIGNED),
  [KafkaTopics.CLINIC_STAFF_REMOVED]:                     devT(KafkaTopics.CLINIC_STAFF_REMOVED),
  [KafkaTopics.APPOINTMENT_CREATED]:                      devT(KafkaTopics.APPOINTMENT_CREATED),
  [KafkaTopics.APPOINTMENT_UPDATED]:                      devT(KafkaTopics.APPOINTMENT_UPDATED),
  [KafkaTopics.APPOINTMENT_CANCELLED]:                    devT(KafkaTopics.APPOINTMENT_CANCELLED),
  [KafkaTopics.APPOINTMENT_COMPLETED]:                    devT(KafkaTopics.APPOINTMENT_COMPLETED),
  [KafkaTopics.SCHEDULE_UPDATED]:                         devT(KafkaTopics.SCHEDULE_UPDATED),
  [KafkaTopics.NOTIFICATION_SENT]:                        devT(KafkaTopics.NOTIFICATION_SENT),
  [KafkaTopics.NOTIFICATION_FAILED]:                      devT(KafkaTopics.NOTIFICATION_FAILED),
  [KafkaTopics.REMINDER_SCHEDULED]:                       devT(KafkaTopics.REMINDER_SCHEDULED),
  [KafkaTopics.REMINDER_SENT]:                            devT(KafkaTopics.REMINDER_SENT),
  [KafkaTopics.REMINDER_FAILED]:                          devT(KafkaTopics.REMINDER_FAILED),
  [KafkaTopics.AUDIT_LOG]:                                devT(KafkaTopics.AUDIT_LOG),
  [KafkaTopics.ACCOUNT_LINKED_DLT]:                       devDlt(KafkaTopics.ACCOUNT_LINKED_DLT),
  [KafkaTopics.ACCOUNT_UNLINKED_DLT]:                     devDlt(KafkaTopics.ACCOUNT_UNLINKED_DLT),
  [KafkaTopics.USER_CREATE_CLINIC_ADMIN_PENDING_DLT]:     devDlt(KafkaTopics.USER_CREATE_CLINIC_ADMIN_PENDING_DLT),
  [KafkaTopics.CLINIC_ADMIN_ACTIVATE_DLT]:                devDlt(KafkaTopics.CLINIC_ADMIN_ACTIVATE_DLT),
  [KafkaTopics.USER_CREATE_DLT]:                          devDlt(KafkaTopics.USER_CREATE_DLT),
  [KafkaTopics.USER_VERIFY_OTP_DLT]:                      devDlt(KafkaTopics.USER_VERIFY_OTP_DLT),
  [KafkaTopics.USER_LOGIN_REQUEST_DLT]:                   devDlt(KafkaTopics.USER_LOGIN_REQUEST_DLT),
  [KafkaTopics.USER_CHECK_EXISTS_DLT]:                    devDlt(KafkaTopics.USER_CHECK_EXISTS_DLT),
  [KafkaTopics.USER_LINK_PATIENT_ACCOUNT_DLT]:            devDlt(KafkaTopics.USER_LINK_PATIENT_ACCOUNT_DLT),
  [KafkaTopics.USER_UNLINK_ACCOUNT_DLT]:                  devDlt(KafkaTopics.USER_UNLINK_ACCOUNT_DLT),
  [KafkaTopics.USER_GET_LINKED_ACCOUNTS_DLT]:             devDlt(KafkaTopics.USER_GET_LINKED_ACCOUNTS_DLT),
  [KafkaTopics.USER_CREATE_BY_ADMIN_DLT]:                 devDlt(KafkaTopics.USER_CREATE_BY_ADMIN_DLT),
  [KafkaTopics.USER_CREATED_DLT]:                         devDlt(KafkaTopics.USER_CREATED_DLT),
};

export const getTopicConfig = (topic: KafkaTopics): TopicConfig => TopicConfigurations[topic];
export const getAllTopics = (): TopicConfig[] => Object.values(TopicConfigurations);
export const getDockerComposeTopics = (): TopicConfig[] =>
  Object.values(DockerComposeTopicConfigurations);

/**
 * Generates kafka-topics CLI lines for docker-compose / shell init.
 */
export function generateKafkaInitScript(bootstrapServer = 'kafka-1:9092'): string {
  return generateKafkaInitScriptForTopics(getAllTopics(), bootstrapServer);
}

/** Docker Compose single-broker init script body (kafka-topics commands only). */
export function generateDockerKafkaInitScript(bootstrapServer = 'kafka-1:9092'): string {
  return generateKafkaInitScriptForTopics(getDockerComposeTopics(), bootstrapServer);
}

function generateKafkaInitScriptForTopics(
  topics: TopicConfig[],
  bootstrapServer: string,
): string {
  return topics
    .map((tc) => {
      const configArgs = tc.config
        ? Object.entries(tc.config)
            .map(([k, v]) => `--config ${k}=${v}`)
            .join(' ')
        : '';
      return (
        `kafka-topics --bootstrap-server ${bootstrapServer}` +
        ` --create --if-not-exists` +
        ` --topic ${tc.name}` +
        ` --partitions ${tc.partitions}` +
        ` --replication-factor ${tc.replicationFactor}` +
        (configArgs ? ` ${configArgs}` : '')
      );
    })
    .join('\n');
}

/**
 * POSIX shell script for docker-compose kafka-init service.
 * Regenerate: cd kafka-config && npm run generate:kafka-init-sh
 */
export function generateDockerKafkaInitShellScript(
  bootstrapServer = 'kafka-1:9092',
): string {
  const createLines = getDockerComposeTopics()
    .map((tc) => {
      const retention = tc.config?.['retention.ms'] ?? SEVEN_DAYS_MS;
      return `create_topic ${tc.name} ${tc.partitions} ${retention}`;
    })
    .join('\n');

  return `#!/bin/sh
# Generated from kafka-config/topics/topics.config.ts — do not edit by hand.
# Regenerate: cd kafka-config && npm run generate:kafka-init-sh
set -eu

BROKERS="${bootstrapServer}"

echo "Waiting for Kafka broker at \${BROKERS}..."
until kafka-broker-api-versions --bootstrap-server "\${BROKERS}" >/dev/null 2>&1; do
  echo "Waiting for Kafka..."
  sleep 5
done

echo "Kafka available at \${BROKERS}"

create_topic() {
  topic_name="\$1"
  partition_count="\$2"
  retention_ms="\$3"
  kafka-topics --bootstrap-server "\${BROKERS}" \\
    --create --if-not-exists \\
    --topic "\${topic_name}" \\
    --partitions "\${partition_count}" \\
    --replication-factor 1 \\
    --config "retention.ms=\${retention_ms}"
}

${createLines}

echo "Topic initialization completed"
`;
}
