# MediCare — Class Diagrams

One diagram per service. Only real entities, enums, and key relationships from the source code.

---

## 1. User Service (`user_db`)

```mermaid
classDiagram
    class User {
        +String id
        +String phoneNumber
        +String username
        +String firstName
        +String lastName
        +String email
        +String password
        +UserRole role
        +UserStatus status
        +Boolean isPhoneVerified
        +Boolean isEmailVerified
        +Boolean isDashboardActivated
        +Boolean mustChangePassword
        +Date activationExpiresAt
        +String linkedSystemManagerId
        +String clinicId
        +String[] permissions
        +String specialization
        +String licenseNumber
        +Date createdAt
        +Date updatedAt
        +Date deletedAt
        +getDefaultPermissionsForRole() String[]
        +hasPermission(permission) Boolean
        +canCreateUser(targetRole) Boolean
    }

    class PasswordHistory {
        +String id
        +String userId
        +String passwordHash
        +Date createdAt
    }

    class UserAccountLink {
        +String id
        +String systemManagerId
        +String userId
        +String linkType
        +Boolean isActive
        +Date createdAt
    }

    class OutboxEvent {
        +String id
        +String aggregateId
        +String aggregateType
        +String eventType
        +Object payload
        +OutboxStatus status
        +Number retryCount
        +String lastError
        +Date createdAt
        +Date publishedAt
    }

    class ProcessedMessage {
        +String messageId
        +String topic
        +Date processedAt
    }

    class UserRole {
        <<enumeration>>
        PATIENT
        DOCTOR
        SECRETARY
        CLINIC_ADMIN
        SYSTEM_MANAGER
    }

    class UserStatus {
        <<enumeration>>
        PENDING
        PENDING_ACTIVATION
        ACTIVE
        INACTIVE
        SUSPENDED
        DELETED
    }

    class OutboxStatus {
        <<enumeration>>
        PENDING
        PUBLISHED
        FAILED
    }

    User "1" --> "*" PasswordHistory : has
    User --> UserRole
    User --> UserStatus
    OutboxEvent --> OutboxStatus
```

---

## 2. Auth Service (`auth_db`)

```mermaid
classDiagram
    class Session {
        +String id
        +String sessionId
        +String userId
        +String refreshTokenHash
        +Object deviceInfo
        +SessionStatus status
        +Date expiresAt
        +Date revokedAt
        +Date lastActivityAt
        +Number tokenRotationCount
        +String tokenFamilyId
        +Boolean reuseDetected
        +Boolean isSuspicious
        +String suspiciousReason
        +Boolean isCurrent
        +Date createdAt
        +Date updatedAt
        +isExpired() Boolean
        +isActive() Boolean
        +revoke()
        +updateLastActivity()
        +incrementTokenRotation()
    }

    class Otp {
        +String id
        +String codeHash
        +String phoneNumber
        +OtpType type
        +Boolean isUsed
        +Number failedAttempts
        +Date expiresAt
        +Date createdAt
        +hashCode(code, phone, type)$ String
    }

    class AuditLog {
        +String id
        +String userId
        +String sessionId
        +AuditAction action
        +AuditResource resource
        +String resourceId
        +String requestId
        +String ip
        +String risk
        +Object metadata
        +String severity
        +Boolean success
        +Date createdAt
    }

    class AccountLock {
        +String id
        +String identifier
        +Date lockedUntil
        +LockTierDb tier
        +Number failedAttempts
        +Date createdAt
        +Date updatedAt
    }

    class JwtBlocklistEntry {
        +String jti
        +Date expiresAt
        +Date createdAt
    }

    class IdempotencyKey {
        +String id
        +String key
        +String requestHash
        +String endpoint
        +Object response
        +Number statusCode
        +Date expiresAt
        +Date createdAt
    }

    class SessionStatus {
        <<enumeration>>
        ACTIVE
        REVOKED
        EXPIRED
    }

    class OtpType {
        <<enumeration>>
        PHONE_VERIFICATION
        PASSWORD_RESET
        LOGIN_VERIFICATION
    }

    class LockTierDb {
        <<enumeration>>
        NONE
        SHORT
        MEDIUM
        ADMIN_REVIEW
    }

    class AuditAction {
        <<enumeration>>
        LOGIN
        LOGOUT
        REGISTER
        PASSWORD_CHANGE
        OTP_SENT
        OTP_VERIFIED
        FAILED_LOGIN
        SUSPICIOUS_ACTIVITY
    }

    Session --> SessionStatus
    Otp --> OtpType
    AccountLock --> LockTierDb
    AuditLog --> AuditAction
```

---

## 3. System Manager Service (`system_db`)

```mermaid
classDiagram
    class SystemManager {
        +String id
        +String username
        +String password
        +String firstName
        +String lastName
        +String email
        +String phoneNumber
        +Boolean isActive
        +String[] linkedUserIds
        +Date createdAt
        +Date updatedAt
    }

    class ClinicAdminActivation {
        +String id
        +String code
        +String idNumber
        +String phoneNumber
        +String fullName
        +ActivationCodeStatus status
        +Date expiresAt
        +Date usedAt
        +Date revokedAt
        +String generatedBy
        +String clinicLocation
        +Number price
        +Boolean isCashPaymentDone
        +Object metadata
        +Number attemptCount
        +Date activatedAt
        +Date createdAt
        +Date updatedAt
    }

    class ActivationCodeStatus {
        <<enumeration>>
        PENDING
        USED
        EXPIRED
        REVOKED
    }

    SystemManager "1" --> "*" ClinicAdminActivation : generates
    ClinicAdminActivation --> ActivationCodeStatus
```

---

## 4. Clinic Service (`clinic_db`)

```mermaid
classDiagram
    class Clinic {
        +String id
        +String name
        +String description
        +String address
        +String city
        +String governorate
        +String phone
        +String email
        +String timezone
        +ClinicStatus status
        +String activationCodeId
        +String adminPhoneNumber
        +String adminUserId
        +Date createdAt
        +Date updatedAt
    }

    class ClinicStaffAssignment {
        +String id
        +String clinicId
        +String userId
        +StaffRole staffRole
        +AssignmentStatus status
        +String assignedBy
        +Date assignedAt
        +Date updatedAt
    }

    class ClinicStatus {
        <<enumeration>>
        ACTIVE
        INACTIVE
        ARCHIVED
    }

    class StaffRole {
        <<enumeration>>
        CLINIC_ADMIN
        DOCTOR
        SECRETARY
    }

    class AssignmentStatus {
        <<enumeration>>
        ACTIVE
        INACTIVE
    }

    Clinic "1" --> "*" ClinicStaffAssignment : has
    ClinicStaffAssignment --> StaffRole
    ClinicStaffAssignment --> AssignmentStatus
    Clinic --> ClinicStatus
```

---

## 5. Scheduling Service (`scheduling_db`)

```mermaid
classDiagram
    class ClinicHours {
        +String id
        +String clinicId
        +Number dayOfWeek
        +String openTime
        +String closeTime
        +Boolean isClosed
    }

    class DoctorAvailability {
        +String id
        +String clinicId
        +String doctorId
        +Number dayOfWeek
        +String startTime
        +String endTime
        +Number slotDurationMinutes
    }

    class ScheduleBlock {
        +String id
        +String clinicId
        +String doctorId
        +Date startsAt
        +Date endsAt
        +String reason
        +String createdBy
    }

    ClinicHours ..> DoctorAvailability : same clinicId
    DoctorAvailability ..> ScheduleBlock : same clinicId + doctorId
```

---

## 6. Appointment Service (`appointment_db`)

```mermaid
classDiagram
    class Appointment {
        +String id
        +String clinicId
        +String doctorId
        +String patientId
        +Date scheduledAt
        +Number durationMinutes
        +AppointmentStatus status
        +String reason
        +String notes
        +String createdBy
        +String cancelledBy
        +Date cancelledAt
        +String cancellationReason
        +Date createdAt
        +Date updatedAt
    }

    class AppointmentStatus {
        <<enumeration>>
        REQUESTED
        CONFIRMED
        CANCELLED
        COMPLETED
        NO_SHOW
    }

    Appointment --> AppointmentStatus
```

---

## 7. Notification Service (`notification_db`)

```mermaid
classDiagram
    class NotificationLog {
        +String id
        +String appointmentId
        +String patientId
        +NotificationType type
        +NotificationChannel channel
        +String recipientPhone
        +NotificationStatus status
        +Object payload
        +String errorMessage
        +Date createdAt
    }

    class NotificationType {
        <<enumeration>>
        APPOINTMENT_CONFIRMED
        APPOINTMENT_CANCELLED
        APPOINTMENT_RESCHEDULED
        APPOINTMENT_REMINDER
    }

    class NotificationChannel {
        <<enumeration>>
        WHATSAPP
    }

    class NotificationStatus {
        <<enumeration>>
        SENT
        FAILED
    }

    NotificationLog --> NotificationType
    NotificationLog --> NotificationChannel
    NotificationLog --> NotificationStatus
```

---

## 8. Reminder Service (`reminder_db`)

```mermaid
classDiagram
    class ScheduledReminder {
        +String id
        +String appointmentId
        +String clinicId
        +String patientId
        +String doctorId
        +Date appointmentAt
        +Date remindAt
        +ReminderStatus status
        +Date sentAt
        +String lastError
        +Date createdAt
        +Date updatedAt
    }

    class ReminderStatus {
        <<enumeration>>
        PENDING
        SENT
        CANCELLED
        FAILED
    }

    ScheduledReminder --> ReminderStatus
```

---

## 9. EMR Service (`emr_db`)

```mermaid
classDiagram
    class PatientEmrLink {
        +String id
        +String userId
        +String openemrPatientId
        +EmrSyncStatus syncStatus
        +String lastError
        +String phoneNumber
        +Date createdAt
        +Date updatedAt
    }

    class OpenEmrOAuthConfig {
        +Number id
        +String clientId
        +String clientSecret
        +Date registeredAt
    }

    class EmrSyncStatus {
        <<enumeration>>
        PENDING
        SYNCED
        FAILED
    }

    PatientEmrLink --> EmrSyncStatus
```

---

## 10. AI Service (`ai_db`)

```mermaid
classDiagram
    class AiRequest {
        +String id
        +String userId
        +String role
        +String endpoint
        +Number promptTokens
        +Number completionTokens
        +Number executionTime
        +Date createdAt
    }
```

---

## Cross-Service References (logical, no DB foreign keys)

```mermaid
classDiagram
    class User["User (user_db)"] {
        +String id
    }
    class Clinic["Clinic (clinic_db)"] {
        +String adminUserId
    }
    class ClinicStaffAssignment["ClinicStaffAssignment (clinic_db)"] {
        +String userId
        +String clinicId
    }
    class Appointment["Appointment (appointment_db)"] {
        +String patientId
        +String doctorId
        +String clinicId
    }
    class ScheduledReminder["ScheduledReminder (reminder_db)"] {
        +String appointmentId
        +String patientId
    }
    class NotificationLog["NotificationLog (notification_db)"] {
        +String appointmentId
        +String patientId
    }
    class PatientEmrLink["PatientEmrLink (emr_db)"] {
        +String userId
    }
    class ClinicAdminActivation["ClinicAdminActivation (system_db)"] {
        +String generatedBy
    }

    User "1" ..> "*" ClinicStaffAssignment : userId ref
    User "1" ..> "*" Appointment : patientId / doctorId ref
    User "1" ..> "1" PatientEmrLink : userId ref
    Clinic "1" ..> "*" ClinicStaffAssignment : clinicId ref
    Clinic "1" ..> "*" Appointment : clinicId ref
    Appointment "1" ..> "1" ScheduledReminder : appointmentId ref
    Appointment "1" ..> "*" NotificationLog : appointmentId ref
```
