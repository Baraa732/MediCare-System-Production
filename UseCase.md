# MediCare — Use Case Diagrams

One diagram per actor group. Simple, business-level goals only.

---

## Actors

| Actor | Role in code | What they do |
|-------|-------------|---------------|
| Patient | `PATIENT` | Register, login, book appointments, view EMR, AI chat |
| Doctor | `DOCTOR` | Login (MFA), manage schedule, view patient EMR, AI tools |
| Secretary | `SECRETARY` | Book appointments, look up patients, manage schedule |
| Clinic Admin | `CLINIC_ADMIN` | Activate clinic, create staff, manage clinic, AI tools |
| System Manager | `SYSTEM_MANAGER` | Platform admin, onboard clinics, manage users |
| WhatsApp | External | Delivers OTP and appointment notifications |
| OpenEMR | External | Clinical records system |
| AI (Ollama/DeepSeek) | External | LLM powering clinical assistance |

---

## 1. Patient

```mermaid
flowchart LR
    Patient([Patient])
    WA([WhatsApp])
    EMR([OpenEMR])
    AI([AI Service])

    subgraph MediCare
        UC1(Register)
        UC2(Login)
        UC3(Reset Password)
        UC4(View & Edit Profile)
        UC5(Browse Doctors)
        UC6(Book Appointment)
        UC7(View My Appointments)
        UC8(View My EMR)
        UC9(Chat with AI Assistant)
        UC10(View Notifications)
        UC11(Verify OTP)
        UC12(Require MFA)

        UC1 -.->|include| UC11
        UC2 -.->|include| UC11
        UC3 -.->|include| UC11
        UC2 -.->|extend| UC12
    end

    Patient --> UC1
    Patient --> UC2
    Patient --> UC3
    Patient --> UC4
    Patient --> UC5
    Patient --> UC6
    Patient --> UC7
    Patient --> UC8
    Patient --> UC9
    Patient --> UC10

    UC11 --> WA
    UC8 --> EMR
    UC9 --> AI
```

---

## 2. Doctor

```mermaid
flowchart LR
    Doctor([Doctor])
    WA([WhatsApp])
    EMR([OpenEMR])
    AI([AI Service])

    subgraph MediCare
        UC1(Login with MFA)
        UC2(Complete Account Activation)
        UC3(View & Edit Profile)
        UC4(Set Availability)
        UC5(Create Schedule Block)
        UC6(View Patient EMR)
        UC7(Complete Appointment)
        UC8(Mark No-Show)
        UC9(Generate Clinical Summary)
        UC10(Generate Medical Report)
        UC11(Generate SOAP Note)
        UC12(Use Doctor AI Chat)
        UC13(Verify OTP)
        UC14(Require MFA)

        UC1 -.->|include| UC14
        UC14 -.->|include| UC13
        UC2 -.->|include| UC13
    end

    Doctor --> UC1
    Doctor --> UC2
    Doctor --> UC3
    Doctor --> UC4
    Doctor --> UC5
    Doctor --> UC6
    Doctor --> UC7
    Doctor --> UC8
    Doctor --> UC9
    Doctor --> UC10
    Doctor --> UC11
    Doctor --> UC12

    UC13 --> WA
    UC6 --> EMR
    UC9 --> AI
    UC10 --> AI
    UC11 --> AI
    UC12 --> AI
```

---

## 3. Secretary

```mermaid
flowchart LR
    Secretary([Secretary])
    WA([WhatsApp])
    AI([AI Service])

    subgraph MediCare
        UC1(Login)
        UC2(Complete Account Activation)
        UC3(View & Edit Profile)
        UC4(Look Up Patient)
        UC5(Book Appointment)
        UC6(Cancel Appointment)
        UC7(View Clinic Appointments)
        UC8(Set Clinic Hours)
        UC9(Create Schedule Block)
        UC10(Generate Clinical Summary)
        UC11(Clean OCR Document)
        UC12(Verify OTP)

        UC1 -.->|include| UC12
        UC2 -.->|include| UC12
    end

    Secretary --> UC1
    Secretary --> UC2
    Secretary --> UC3
    Secretary --> UC4
    Secretary --> UC5
    Secretary --> UC6
    Secretary --> UC7
    Secretary --> UC8
    Secretary --> UC9
    Secretary --> UC10
    Secretary --> UC11

    UC12 --> WA
    UC10 --> AI
    UC11 --> AI
```

---

## 4. Clinic Admin

```mermaid
flowchart LR
    ClinicAdmin([Clinic Admin])
    WA([WhatsApp])
    EMR([OpenEMR])
    AI([AI Service])

    subgraph MediCare
        UC1(Activate Clinic Dashboard)
        UC2(Login with MFA)
        UC3(Create Doctor Account)
        UC4(Create Secretary Account)
        UC5(Manage Clinic Info)
        UC6(Assign Staff to Clinic)
        UC7(Remove Staff from Clinic)
        UC8(Look Up Patient)
        UC9(Book Appointment)
        UC10(View Patient EMR)
        UC11(Set Clinic Hours)
        UC12(Use AI Tools)
        UC13(Clean OCR Document)
        UC14(Verify OTP)
        UC15(Require MFA)
        UC16(Validate Activation Code)

        UC1 -.->|include| UC16
        UC2 -.->|include| UC15
        UC15 -.->|include| UC14
        UC3 -.->|extend| UC14
        UC4 -.->|extend| UC14
    end

    ClinicAdmin --> UC1
    ClinicAdmin --> UC2
    ClinicAdmin --> UC3
    ClinicAdmin --> UC4
    ClinicAdmin --> UC5
    ClinicAdmin --> UC6
    ClinicAdmin --> UC7
    ClinicAdmin --> UC8
    ClinicAdmin --> UC9
    ClinicAdmin --> UC10
    ClinicAdmin --> UC11
    ClinicAdmin --> UC12
    ClinicAdmin --> UC13

    UC16 --> WA
    UC14 --> WA
    UC10 --> EMR
    UC12 --> AI
    UC13 --> AI
```

---

## 5. System Manager

```mermaid
flowchart LR
    SM([System Manager])
    EMR([OpenEMR])

    subgraph MediCare
        UC1(Login)
        UC2(Create Another System Manager)
        UC3(Generate Clinic Activation Code)
        UC4(Revoke Activation Code)
        UC5(Check Activation Code Status)
        UC6(List All Users)
        UC7(Activate / Deactivate User)
        UC8(Delete User)
        UC9(Link Patient to Account)
        UC10(Unlink Patient)
        UC11(View AI Metrics)
        UC12(Record Audit Event)
        UC13(Create Patient Record)

        UC3 -.->|include| UC12
        UC4 -.->|include| UC12
        UC9 -.->|extend| UC13
    end

    SM --> UC1
    SM --> UC2
    SM --> UC3
    SM --> UC4
    SM --> UC5
    SM --> UC6
    SM --> UC7
    SM --> UC8
    SM --> UC9
    SM --> UC10
    SM --> UC11

    UC9 --> EMR
    UC13 --> EMR
```

---

## 6. Endpoint Reference

| Use case | HTTP endpoint |
|----------|---------------|
| Register | `POST /api/auth/register` |
| Login | `POST /api/auth/login` |
| Verify MFA | `POST /api/auth/verify-mfa` |
| Verify OTP | `POST /api/auth/verify-otp` |
| Reset Password | `POST /api/auth/reset-password` |
| Logout | `POST /api/auth/logout` |
| Complete Activation | `POST /api/auth/staff/complete-activation` |
| Activate Clinic Dashboard | `POST /api/auth/clinic-admin/activate` |
| Create Staff Account | `POST /api/auth/clinic/create-user` |
| View / Edit Profile | `GET/PUT /api/users/:id` |
| Browse Doctors | `GET /api/users/doctors/public` |
| Look Up Patient | `GET /api/users/lookup/patient/:phone` |
| List All Users | `GET /api/users` |
| Link Patient | `POST /api/account-linking/link-patient` |
| Generate Activation Code | `POST /api/system-manager/activation-code/generate` |
| Revoke Activation Code | `POST /api/system-manager/activation-code/revoke` |
| Manage Clinic | `POST/PUT/DELETE /api/clinics` |
| Assign Staff | `POST /api/clinics/:id/staff` |
| Set Clinic Hours | `PUT /api/schedule/clinics/:id/hours` |
| Set Doctor Availability | `POST /api/schedule/availability` |
| Create Schedule Block | `POST /api/schedule/blocked` |
| View Available Slots | `GET /api/schedule/slots` |
| Book Appointment | `POST /api/appointments` |
| View My Appointments | `GET /api/appointments/me` |
| Update Appointment Status | `PATCH /api/appointments/:id/status` |
| View My Notifications | `GET /api/notifications/me` |
| View Own EMR | `GET /api/emr/me` |
| View Patient EMR | `GET /api/emr/patients/:userId` |
| AI Summary | `POST /api/ai/summary` |
| AI Medical Report | `POST /api/ai/report` |
| AI SOAP Note | `POST /api/ai/appointment-note` |
| AI Patient Chat | `POST /api/ai/patient-chat` |
| AI Doctor Chat | `POST /api/ai/doctor-chat` |
| AI OCR Cleanup | `POST /api/ai/ocr-cleanup` |
| AI Metrics | `GET /api/ai/metrics` |

---

*Generated from source controllers. All routes go through the API Gateway at `:3000`.*
