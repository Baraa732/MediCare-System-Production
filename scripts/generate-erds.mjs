import fs from 'fs';
import path from 'path';

const OUT = String.raw`C:\Users\Baraa\Desktop\test routing\ERD's`;

const C = {
  page: '#0d1117',
  title: '#e6edf3',
  subtitle: '#8b949e',
  tableBg: '#161b22',
  tableHeader: '#21262d',
  border: '#30363d',
  accent: '#58a6ff',
  pk: '#fbbf24',
  fk: '#a78bfa',
  col: '#c9d1d9',
  edge: '#58a6ff',
  edgeLogical: '#6e7681',
};

/** @typedef {{ name: string, cols: string[], pk?: string[] }} Table */
/** @typedef {{ from: string, to: string, label?: string, style?: 'fk'|'logical' }} Rel */

const services = [
  {
    file: 'auth-service',
    title: 'auth-service',
    db: 'auth_db',
    desc: 'Authentication, sessions, OTP, rate limits, JWT revocation, PHI audit',
    tables: [
      {
        name: 'sessions',
        cols: [
          'id UUID PK',
          'sessionId VARCHAR UNIQUE',
          'userId UUID',
          'tenant_id UUID NULL',
          'refreshTokenHash VARCHAR NULL',
          'deviceInfo JSONB NULL',
          'status ENUM(active|revoked|expired)',
          'expiresAt TIMESTAMP',
          'revokedAt TIMESTAMP NULL',
          'lastActivityAt TIMESTAMP NULL',
          'tokenRotationCount INT',
          'tokenFamilyId VARCHAR NULL',
          'reuseDetected BOOLEAN',
          'isSuspicious BOOLEAN',
          'suspiciousReason VARCHAR NULL',
          'isCurrent BOOLEAN',
          'createdAt TIMESTAMP',
          'updatedAt TIMESTAMP',
        ],
      },
      {
        name: 'otps',
        cols: [
          'id UUID PK',
          'code_hash VARCHAR',
          'phoneNumber VARCHAR',
          'type ENUM(phone_verification|password_reset|login_verification)',
          'isUsed BOOLEAN',
          'failedAttempts INT',
          'expiresAt TIMESTAMP',
          'createdAt TIMESTAMP',
        ],
      },
      {
        name: 'audit_logs',
        cols: [
          'id UUID PK',
          'userId VARCHAR NULL',
          'tenant_id UUID NULL',
          'sessionId VARCHAR NULL',
          'action ENUM(login|logout|register|...)',
          'resource ENUM(user|session|token|...)',
          'resourceId VARCHAR NULL',
          'requestId VARCHAR NULL',
          'ip VARCHAR NULL',
          'device VARCHAR NULL',
          'risk VARCHAR DEFAULT low',
          'metadata JSONB NULL',
          'severity VARCHAR',
          'description VARCHAR NULL',
          'success BOOLEAN',
          'errorMessage VARCHAR NULL',
          'createdAt TIMESTAMP',
        ],
      },
      {
        name: 'phi_audit_logs',
        cols: [
          'id UUID PK',
          'timestamp TIMESTAMPTZ',
          'actor_id UUID NULL',
          'actor_role VARCHAR NULL',
          'tenant_id UUID NULL',
          'action VARCHAR(128)',
          'resource_type VARCHAR(64)',
          'resource_id VARCHAR NULL',
          'ip VARCHAR(45) NULL',
          'user_agent VARCHAR(512) NULL',
          'request_id VARCHAR(64) NULL',
          'success BOOLEAN',
          'classification VARCHAR(32)',
          'source_service VARCHAR(64) NULL',
          'internal_call BOOLEAN',
          'recorded_at TIMESTAMPTZ',
        ],
      },
      {
        name: 'trusted_devices',
        cols: [
          'id UUID PK',
          'userId VARCHAR',
          'deviceHash VARCHAR(128)',
          'deviceLabel VARCHAR(128) NULL',
          'metadata JSONB NULL',
          'expiresAt TIMESTAMPTZ NULL',
          'revokedAt TIMESTAMPTZ NULL',
          'lastUsedAt TIMESTAMPTZ NULL',
          'createdAt TIMESTAMPTZ',
          'updatedAt TIMESTAMPTZ',
        ],
      },
      {
        name: 'jwt_blocklist',
        cols: [
          'jti VARCHAR(36) PK',
          'expires_at TIMESTAMPTZ',
          'created_at TIMESTAMPTZ',
        ],
      },
      {
        name: 'account_locks',
        cols: [
          'id UUID PK',
          'identifier VARCHAR(64) UNIQUE',
          'locked_until TIMESTAMPTZ NULL',
          'tier VARCHAR(20)',
          'failed_attempts INT',
          'created_at TIMESTAMPTZ',
          'updated_at TIMESTAMPTZ',
        ],
      },
      {
        name: 'rate_limits',
        cols: [
          'id UUID PK',
          'identifier VARCHAR',
          'type ENUM(login|otp|otp_verify|register|api|...)',
          'count INT',
          'maxRequests INT',
          'windowStart TIMESTAMP',
          'expiresAt TIMESTAMP',
          'blockedUntil TIMESTAMP NULL',
          'isBlocked BOOLEAN',
          'metadata JSONB NULL',
          'createdAt TIMESTAMP',
        ],
      },
      {
        name: 'idempotency_keys',
        cols: [
          'id UUID PK',
          'key VARCHAR UNIQUE',
          'requestHash VARCHAR',
          'endpoint VARCHAR',
          'response JSONB',
          'statusCode INT',
          'expiresAt TIMESTAMP',
          'createdAt TIMESTAMP',
        ],
      },
    ],
    rels: [
      { from: 'sessions', to: 'users (user-service)', label: 'userId', style: 'logical' },
      { from: 'trusted_devices', to: 'users (user-service)', label: 'userId', style: 'logical' },
    ],
  },
  {
    file: 'user-service',
    title: 'user-service',
    db: 'user_db',
    desc: 'User profiles, password history, transactional outbox, Kafka idempotency',
    tables: [
      {
        name: 'users',
        cols: [
          'id UUID PK',
          'phoneNumber VARCHAR UNIQUE',
          'username VARCHAR UNIQUE NULL',
          'firstName VARCHAR',
          'lastName VARCHAR',
          'email VARCHAR UNIQUE NULL',
          'password VARCHAR',
          'role ENUM(PATIENT|DOCTOR|SECRETARY|CLINIC_ADMIN|SYSTEM_MANAGER)',
          'status ENUM(PENDING|ACTIVE|...)',
          'isPhoneVerified BOOLEAN',
          'isEmailVerified BOOLEAN',
          'isDashboardActivated BOOLEAN',
          'mustChangePassword BOOLEAN',
          'activationExpiresAt TIMESTAMPTZ NULL',
          'linkedSystemManagerId VARCHAR NULL',
          'tenant_id UUID NULL (legacy)',
          'permissions TEXT[]',
          'specialization VARCHAR NULL',
          'licenseNumber VARCHAR NULL',
          'profileData JSONB NULL',
          'createdAt TIMESTAMP',
          'updatedAt TIMESTAMP',
          'deletedAt TIMESTAMP NULL',
        ],
      },
      {
        name: 'password_history',
        cols: [
          'id UUID PK',
          'user_id UUID FK → users.id',
          'password_hash VARCHAR(255)',
          'created_at TIMESTAMPTZ',
        ],
      },
      {
        name: 'outbox_events',
        cols: [
          'id UUID PK',
          'aggregateId VARCHAR',
          'aggregateType VARCHAR',
          'eventType VARCHAR',
          'payload JSONB',
          'status ENUM(pending|published|failed)',
          'retryCount INT',
          'lastError VARCHAR NULL',
          'createdAt TIMESTAMP',
          'publishedAt TIMESTAMP NULL',
        ],
      },
      {
        name: 'processed_messages',
        cols: [
          'message_id VARCHAR(128) PK',
          'topic VARCHAR(128) PK',
          'processed_at TIMESTAMPTZ',
        ],
      },
    ],
    rels: [{ from: 'password_history', to: 'users', label: 'user_id FK', style: 'fk' }],
  },
  {
    file: 'clinic-service',
    title: 'clinic-service',
    db: 'clinic_db',
    desc: 'Tenants (clinics), staff assignments, clinic metadata',
    tables: [
      {
        name: 'tenants',
        cols: [
          'id UUID PK',
          'name VARCHAR(200)',
          'slug VARCHAR(100) UNIQUE',
          'status VARCHAR(20) DEFAULT ACTIVE',
          'subscription_plan VARCHAR(50)',
          'description TEXT NULL',
          'address VARCHAR(300) NULL',
          'city VARCHAR(100) NULL',
          'governorate VARCHAR(100) NULL',
          'latitude DOUBLE NULL',
          'longitude DOUBLE NULL',
          'phone VARCHAR(30) NULL',
          'email VARCHAR(200) NULL',
          'logo_url VARCHAR(500) NULL',
          'timezone VARCHAR(64)',
          'activation_code_id UUID UNIQUE NULL',
          'admin_phone_number VARCHAR(20) UNIQUE NULL',
          'admin_user_id UUID NULL',
          'created_at TIMESTAMP',
          'updated_at TIMESTAMP',
        ],
      },
      {
        name: 'tenant_staff_assignments',
        cols: [
          'id UUID PK',
          'tenant_id UUID FK → tenants.id',
          'user_id UUID',
          'staff_role VARCHAR(32)',
          'status VARCHAR(20)',
          'is_primary BOOLEAN',
          'started_at TIMESTAMPTZ NULL',
          'ended_at TIMESTAMPTZ NULL',
          'invitation_id UUID NULL',
          'assigned_by UUID NULL',
          'assigned_at TIMESTAMP',
          'updated_at TIMESTAMP',
          'UNIQUE(tenant_id, user_id)',
        ],
      },
    ],
    rels: [{ from: 'tenant_staff_assignments', to: 'tenants', label: 'tenant_id FK', style: 'fk' }],
  },
  {
    file: 'appointment-service',
    title: 'appointment-service',
    db: 'appointment_db',
    desc: 'Appointments, patient-clinic relations, doctor-patient assignments',
    tables: [
      {
        name: 'appointments',
        cols: [
          'id UUID PK',
          'tenant_id UUID',
          'doctorId UUID',
          'patientId UUID NULL',
          'guestPatientName TEXT NULL',
          'guestPatientPhone TEXT NULL',
          'scheduledAt TIMESTAMPTZ',
          'durationMinutes INT DEFAULT 30',
          'status ENUM(REQUESTED|CONFIRMED|CANCELLED|COMPLETED|NO_SHOW)',
          'reason TEXT NULL',
          'notes TEXT NULL',
          'createdBy UUID',
          'cancelledBy UUID NULL',
          'cancelledAt TIMESTAMPTZ NULL',
          'cancellationReason TEXT NULL',
          'createdAt TIMESTAMP',
          'updatedAt TIMESTAMP',
        ],
      },
      {
        name: 'patient_clinic_relations',
        cols: [
          'id UUID PK',
          'patient_id UUID',
          'tenant_id UUID',
          'first_seen_at TIMESTAMP',
          'last_seen_at TIMESTAMP',
          'UNIQUE(patient_id, tenant_id)',
        ],
      },
      {
        name: 'doctor_patient_assignments',
        cols: [
          'id UUID PK',
          'tenant_id UUID',
          'doctor_id UUID',
          'patient_id UUID',
          'assigned_by UUID NULL',
          'status VARCHAR(20)',
          'assigned_at TIMESTAMP',
          'created_at TIMESTAMP',
          'updated_at TIMESTAMP',
          'UNIQUE(tenant_id, doctor_id, patient_id)',
        ],
      },
    ],
    rels: [
      { from: 'appointments', to: 'tenants (clinic-service)', label: 'tenant_id', style: 'logical' },
      { from: 'patient_clinic_relations', to: 'tenants (clinic-service)', label: 'tenant_id', style: 'logical' },
    ],
  },
  {
    file: 'scheduling-service',
    title: 'scheduling-service',
    db: 'scheduling_db',
    desc: 'Clinic hours, doctor availability, schedule blocks / leave requests',
    tables: [
      {
        name: 'clinic_hours',
        cols: [
          'id UUID PK',
          'tenant_id UUID',
          'dayOfWeek SMALLINT (0=Sun…6=Sat)',
          'openTime VARCHAR(5)',
          'closeTime VARCHAR(5)',
          'isClosed BOOLEAN',
          'UNIQUE(tenant_id, dayOfWeek)',
        ],
      },
      {
        name: 'doctor_availability',
        cols: [
          'id UUID PK',
          'tenant_id UUID',
          'doctorId UUID',
          'dayOfWeek SMALLINT',
          'startTime VARCHAR(5)',
          'endTime VARCHAR(5)',
          'slotDurationMinutes INT DEFAULT 30',
        ],
      },
      {
        name: 'schedule_blocks',
        cols: [
          'id UUID PK',
          'tenant_id UUID',
          'doctorId UUID NULL',
          'startsAt TIMESTAMPTZ',
          'endsAt TIMESTAMPTZ',
          'reason TEXT NULL',
          'status VARCHAR(20) PENDING|APPROVED|REJECTED',
          'createdBy UUID',
          'reviewed_by UUID NULL',
          'reviewed_at TIMESTAMPTZ NULL',
        ],
      },
    ],
    rels: [
      { from: 'clinic_hours', to: 'tenants (clinic-service)', label: 'tenant_id', style: 'logical' },
      { from: 'schedule_blocks', to: 'users (user-service)', label: 'doctorId / reviewed_by', style: 'logical' },
    ],
  },
  {
    file: 'notification-service',
    title: 'notification-service',
    db: 'notification_db',
    desc: 'WhatsApp logs, push tokens, staff/patient inbox, Kafka idempotency',
    tables: [
      {
        name: 'notification_logs',
        cols: [
          'id UUID PK',
          'appointmentId VARCHAR NULL',
          'patientId VARCHAR NULL',
          'type ENUM(APPOINTMENT_CONFIRMED|CANCELLED|...)',
          'channel ENUM(WHATSAPP)',
          'tenant_id VARCHAR NULL',
          'recipientPhone VARCHAR',
          'status ENUM(SENT|FAILED)',
          'payload JSONB NULL',
          'errorMessage TEXT NULL',
          'createdAt TIMESTAMP',
        ],
      },
      {
        name: 'push_device_tokens',
        cols: [
          'id UUID PK',
          'tenant_id UUID NULL',
          'userId UUID',
          'fcmToken TEXT',
          'platform VARCHAR DEFAULT web',
          'deviceLabel VARCHAR NULL',
          'enabled BOOLEAN',
          'createdAt TIMESTAMP',
          'lastSeenAt TIMESTAMP',
        ],
      },
      {
        name: 'staff_inbox_notifications',
        cols: [
          'id UUID PK',
          'userId UUID',
          'category ENUM(APPOINTMENT_CREATED|UPDATED|...)',
          'title VARCHAR',
          'body TEXT',
          'appointmentId VARCHAR NULL',
          'tenant_id VARCHAR NULL',
          'data JSONB NULL',
          'readAt TIMESTAMPTZ NULL',
          'createdAt TIMESTAMP',
        ],
      },
      {
        name: 'patient_inbox_notifications',
        cols: [
          'id UUID PK',
          'userId UUID',
          'category ENUM(APPOINTMENT_CONFIRMED|REMINDER|...)',
          'title VARCHAR',
          'body TEXT',
          'appointmentId VARCHAR NULL',
          'clinicId VARCHAR NULL',
          'data JSONB NULL',
          'readAt TIMESTAMPTZ NULL',
          'createdAt TIMESTAMP',
        ],
      },
      {
        name: 'processed_kafka_messages',
        cols: [
          'message_id VARCHAR(128) PK',
          'topic VARCHAR(128) PK',
          'processed_at TIMESTAMPTZ',
        ],
      },
    ],
    rels: [],
  },
  {
    file: 'reminder-service',
    title: 'reminder-service',
    db: 'reminder_db',
    desc: 'Scheduled appointment reminders and Kafka idempotency',
    tables: [
      {
        name: 'scheduled_reminders',
        cols: [
          'id UUID PK',
          'appointmentId VARCHAR',
          'tenant_id VARCHAR',
          'patientId VARCHAR',
          'doctorId VARCHAR',
          'appointmentAt TIMESTAMPTZ',
          'remindAt TIMESTAMPTZ',
          'status ENUM(PENDING|SENT|CANCELLED|FAILED)',
          'sentAt TIMESTAMPTZ NULL',
          'lastError TEXT NULL',
          'createdAt TIMESTAMP',
          'updatedAt TIMESTAMP',
        ],
      },
      {
        name: 'processed_kafka_messages',
        cols: [
          'message_id VARCHAR(128) PK',
          'topic VARCHAR(128) PK',
          'processed_at TIMESTAMPTZ',
        ],
      },
    ],
    rels: [
      { from: 'scheduled_reminders', to: 'appointments (appointment-service)', label: 'appointmentId', style: 'logical' },
    ],
  },
  {
    file: 'system-manager-service',
    title: 'system-manager-service',
    db: 'system_db',
    desc: 'Platform managers, clinic activation codes, incidents, deployments',
    tables: [
      {
        name: 'system_managers',
        cols: [
          'id UUID PK',
          'username VARCHAR UNIQUE',
          'password VARCHAR',
          'firstName VARCHAR',
          'lastName VARCHAR',
          'email VARCHAR UNIQUE NULL',
          'phoneNumber VARCHAR UNIQUE NULL',
          'isActive BOOLEAN',
          'linkedUserIds JSONB',
          'createdAt TIMESTAMP',
          'updatedAt TIMESTAMP',
        ],
      },
      {
        name: 'clinic_admin_activation_codes',
        cols: [
          'id UUID PK',
          'code VARCHAR UNIQUE',
          'idNumber VARCHAR',
          'phoneNumber VARCHAR',
          'fullName VARCHAR',
          'status ENUM(pending|used|expired|revoked)',
          'expiresAt TIMESTAMP',
          'usedAt TIMESTAMP NULL',
          'revokedAt TIMESTAMP NULL',
          'generatedBy VARCHAR NULL',
          'clinicLocation VARCHAR',
          'clinicType ENUM',
          'registrationLicenseNumber VARCHAR',
          'establishmentDate DATE NULL',
          'specialties TEXT[] NULL',
          'whatsappNumber VARCHAR',
          'email VARCHAR NULL',
          'dateOfBirth DATE NULL',
          'yearsOfExperience INT NULL',
          'documents JSONB NULL',
          'latitude DOUBLE NULL',
          'longitude DOUBLE NULL',
          'address TEXT NULL',
          'serviceRadiusKm INT',
          'price DECIMAL(10,2)',
          'isCashPaymentDone BOOLEAN',
          'metadata JSONB NULL',
          'attemptCount INT',
          'createdAt TIMESTAMP',
          'updatedAt TIMESTAMP',
          'activatedAt TIMESTAMP NULL',
        ],
      },
      {
        name: 'platform_incidents',
        cols: [
          'id VARCHAR PK',
          'title VARCHAR NULL',
          'service VARCHAR NULL',
          'status VARCHAR(32)',
          'assignee VARCHAR NULL',
          'notes TEXT NULL',
          'acknowledgedAt TIMESTAMP NULL',
          'assignedAt TIMESTAMP NULL',
          'resolvedAt TIMESTAMP NULL',
          'escalatedAt TIMESTAMP NULL',
          'resolutionNotes TEXT NULL',
          'createdAt TIMESTAMP',
          'updatedAt TIMESTAMP',
        ],
      },
      {
        name: 'platform_deployments',
        cols: [
          'id UUID PK',
          'service VARCHAR',
          'version VARCHAR NULL',
          'status VARCHAR(32)',
          'actor VARCHAR NULL',
          'startedAt TIMESTAMPTZ',
          'finishedAt TIMESTAMPTZ NULL',
          'durationMs INT NULL',
          'source VARCHAR(32)',
          'createdAt TIMESTAMPTZ',
        ],
      },
    ],
    rels: [
      { from: 'clinic_admin_activation_codes', to: 'tenants (clinic-service)', label: 'activation → tenant', style: 'logical' },
    ],
  },
  {
    file: 'emr-service',
    title: 'emr-service',
    db: 'emr_db',
    desc: 'OpenEMR OAuth config and patient EMR link/sync status',
    tables: [
      {
        name: 'openemr_oauth_config',
        cols: [
          'id INT PK DEFAULT 1',
          'tenant_id UUID UNIQUE NULL',
          'clientId VARCHAR(255)',
          'clientSecret VARCHAR(512)',
          'registeredAt TIMESTAMP',
        ],
      },
      {
        name: 'patient_emr_links',
        cols: [
          'id UUID PK',
          'tenant_id UUID NULL',
          'userId UUID',
          'openemrPatientId VARCHAR(64) NULL',
          'syncStatus ENUM(PENDING|SYNCED|FAILED)',
          'lastError TEXT NULL',
          'phoneNumber VARCHAR(32) NULL',
          'createdAt TIMESTAMP',
          'updatedAt TIMESTAMP',
          'UNIQUE(tenant_id, userId)',
        ],
      },
    ],
    rels: [
      { from: 'patient_emr_links', to: 'users (user-service)', label: 'userId', style: 'logical' },
      { from: 'openemr_oauth_config', to: 'tenants (clinic-service)', label: 'tenant_id', style: 'logical' },
    ],
  },
];

function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tableHtml(name, cols) {
  const rows = cols
    .map((c) => {
      let style = `color:${C.col};`;
      if (/\bPK\b/.test(c)) style = `color:${C.pk};font-weight:bold;`;
      else if (/\bFK\b/.test(c)) style = `color:${C.fk};`;
      return `<div style="${style}font-size:11px;padding:2px 8px;border-top:1px solid ${C.border};">${esc(c)}</div>`;
    })
    .join('');
  return `<div style="background:${C.tableBg};border:2px solid ${C.accent};border-radius:6px;overflow:hidden;font-family:Consolas,monospace;">` +
    `<div style="background:${C.tableHeader};color:#fff;font-weight:bold;font-size:13px;padding:8px 10px;border-bottom:1px solid ${C.border};">${esc(name)}</div>` +
    rows +
    `</div>`;
}

function layoutTables(tables, cols = 2) {
  const W = 320;
  const GAP_X = 60;
  const GAP_Y = 40;
  const START_X = 40;
  const START_Y = 120;
  const positions = {};
  let maxH = 0;
  tables.forEach((t, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const h = 36 + t.cols.length * 22 + 12;
    const x = START_X + col * (W + GAP_X);
    const y = START_Y + row * (maxH + GAP_Y);
    positions[t.name] = { x, y, w: W, h, id: `t${i}` };
    maxH = Math.max(maxH, h);
  });
  return positions;
}

function buildDrawio(svc) {
  const positions = layoutTables(svc.tables, svc.tables.length <= 3 ? svc.tables.length : 2);
  const pageW = Math.max(900, ...Object.values(positions).map((p) => p.x + p.w + 80));
  const pageH = Math.max(700, ...Object.values(positions).map((p) => p.y + p.h + 80));

  let cells = '';
  let id = 2;

  // Dark page background
  cells += `<mxCell id="${id}" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=${C.page};strokeColor=none;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="${pageW}" height="${pageH}" as="geometry"/></mxCell>\n`;
  const bgId = id++;
  void bgId;

  // Title
  cells += `<mxCell id="${id}" value="&lt;div style=&quot;text-align:left;&quot;&gt;&lt;span style=&quot;font-size:22px;font-weight:bold;color:${C.title}&quot;&gt;${esc(svc.title)}&lt;/span&gt;&lt;br&gt;&lt;span style=&quot;font-size:13px;color:${C.accent}&quot;&gt;PostgreSQL — ${esc(svc.db)}&lt;/span&gt;&lt;br&gt;&lt;span style=&quot;font-size:11px;color:${C.subtitle}&quot;&gt;${esc(svc.desc)}&lt;/span&gt;&lt;/div&gt;" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=top;whiteSpace=wrap;rounded=0;" vertex="1" parent="1"><mxGeometry x="40" y="20" width="${pageW - 80}" height="80" as="geometry"/></mxCell>\n`;
  id++;

  const tableIds = {};
  svc.tables.forEach((t, i) => {
    const pos = positions[t.name];
    const cellId = id++;
    tableIds[t.name] = cellId;
    const h = 36 + t.cols.length * 22 + 12;
    cells += `<mxCell id="${cellId}" value="${esc(tableHtml(t.name, t.cols))}" style="text;html=1;strokeColor=none;fillColor=none;overflow=fill;align=left;verticalAlign=top;whiteSpace=wrap;rounded=0;" vertex="1" parent="1"><mxGeometry x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${h}" as="geometry"/></mxCell>\n`;
    void i;
  });

  // Legend
  const legendY = pageH - 50;
  cells += `<mxCell id="${id}" value="&lt;span style=&quot;color:${C.pk};font-size:11px;&quot;&gt;■ PK&lt;/span&gt; &amp;nbsp; &lt;span style=&quot;color:${C.fk};font-size:11px;&quot;&gt;■ FK&lt;/span&gt; &amp;nbsp; &lt;span style=&quot;color:${C.edgeLogical};font-size:11px;&quot;&gt;--- logical ref (cross-service)&lt;/span&gt;" style="text;html=1;strokeColor=none;fillColor=none;align=left;" vertex="1" parent="1"><mxGeometry x="40" y="${legendY}" width="600" height="30" as="geometry"/></mxCell>\n`;
  id++;

  // Relationships
  for (const rel of svc.rels || []) {
    const fromId = tableIds[rel.from];
    const toId = tableIds[rel.to];
    if (!fromId || !toId) continue;
    const dashed = rel.style === 'logical' ? 'dashed=1;dashPattern=8 4;' : '';
    const color = rel.style === 'fk' ? C.fk : C.edgeLogical;
    cells += `<mxCell id="${id}" value="${esc(rel.label || '')}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=${color};fontColor=${C.col};fontSize=10;${dashed}endArrow=ERmany;startArrow=ERone;" edge="1" parent="1" source="${fromId}" target="${toId}"><mxGeometry relative="1" as="geometry"/></mxCell>\n`;
    id++;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" agent="MediCare-ERD-Generator" version="24.7.0" type="device">
  <diagram id="${svc.file}-erd" name="${esc(svc.title)}">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${pageW}" pageHeight="${pageH}" background="${C.page}" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        ${cells}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

fs.mkdirSync(OUT, { recursive: true });

for (const svc of services) {
  const xml = buildDrawio(svc);
  const outPath = path.join(OUT, `${svc.file}.drawio`);
  fs.writeFileSync(outPath, xml, 'utf8');
  console.log(`Wrote ${outPath} (${svc.tables.length} tables)`);
}

console.log(`\nDone — ${services.length} ERD files in ${OUT}`);
