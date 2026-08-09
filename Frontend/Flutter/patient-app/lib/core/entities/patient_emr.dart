class PatientEmrChart {
  final PatientDemographics patient;
  final ContactInformation contactInformation;
  final List<EmergencyContact> emergencyContacts;
  final List<InsuranceRecord> insurance;
  final List<AllergyRecord> allergies;
  final List<ProblemRecord> problems;
  final List<ConditionRecord> conditions;
  final List<MedicationRecord> medications;
  final List<EncounterRecord> encounters;
  final List<VitalSignRecord> vitalSigns;
  final List<LabResultRecord> labResults;
  final List<ImmunizationRecord> immunizations;
  final List<CarePlanRecord> carePlans;
  final List<ClinicalNoteRecord> clinicalNotes;
  final List<DocumentRecord> documents;
  final SyncMetadata syncMetadata;

  const PatientEmrChart({
    required this.patient,
    required this.contactInformation,
    required this.emergencyContacts,
    required this.insurance,
    required this.allergies,
    required this.problems,
    required this.conditions,
    required this.medications,
    required this.encounters,
    required this.vitalSigns,
    required this.labResults,
    required this.immunizations,
    required this.carePlans,
    required this.clinicalNotes,
    required this.documents,
    required this.syncMetadata,
  });

  factory PatientEmrChart.fromJson(Map<String, dynamic> json) {
    List<T> list<T>(String key, T Function(Map<String, dynamic>) map) {
      final raw = json[key];
      if (raw is! List) return const [];
      return raw
          .whereType<Map>()
          .map((e) => map(Map<String, dynamic>.from(e)))
          .toList(growable: false);
    }

    return PatientEmrChart(
      patient: PatientDemographics.fromJson(
        Map<String, dynamic>.from(json['patient'] as Map? ?? const {}),
      ),
      contactInformation: ContactInformation.fromJson(
        Map<String, dynamic>.from(
          json['contactInformation'] as Map? ?? const {},
        ),
      ),
      emergencyContacts: list('emergencyContacts', EmergencyContact.fromJson),
      insurance: list('insurance', InsuranceRecord.fromJson),
      allergies: list('allergies', AllergyRecord.fromJson),
      problems: list('problems', ProblemRecord.fromJson),
      conditions: list('conditions', ConditionRecord.fromJson),
      medications: list('medications', MedicationRecord.fromJson),
      encounters: list('encounters', EncounterRecord.fromJson),
      vitalSigns: list('vitalSigns', VitalSignRecord.fromJson),
      labResults: list('labResults', LabResultRecord.fromJson),
      immunizations: list('immunizations', ImmunizationRecord.fromJson),
      carePlans: list('carePlans', CarePlanRecord.fromJson),
      clinicalNotes: list('clinicalNotes', ClinicalNoteRecord.fromJson),
      documents: list('documents', DocumentRecord.fromJson),
      syncMetadata: SyncMetadata.fromJson(
        Map<String, dynamic>.from(json['syncMetadata'] as Map? ?? const {}),
      ),
    );
  }
}

class PatientDemographics {
  final String? firstName;
  final String? middleName;
  final String? lastName;
  final String? birthDate;
  final String? gender;
  final String? maritalStatus;
  final String? language;
  final String? nationalId;

  const PatientDemographics({
    this.firstName,
    this.middleName,
    this.lastName,
    this.birthDate,
    this.gender,
    this.maritalStatus,
    this.language,
    this.nationalId,
  });

  String get fullName {
    final parts = [firstName, middleName, lastName]
        .whereType<String>()
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty);
    return parts.join(' ');
  }

  factory PatientDemographics.fromJson(Map<String, dynamic> json) {
    return PatientDemographics(
      firstName: _str(json['firstName']),
      middleName: _str(json['middleName']),
      lastName: _str(json['lastName']),
      birthDate: _str(json['birthDate']),
      gender: _str(json['gender']),
      maritalStatus: _str(json['maritalStatus']),
      language: _str(json['language']),
      nationalId: _str(json['nationalId']),
    );
  }
}

class ContactInformation {
  final String? phone;
  final String? email;
  final String? addressLine1;
  final String? addressLine2;
  final String? city;
  final String? state;
  final String? postalCode;
  final String? country;

  const ContactInformation({
    this.phone,
    this.email,
    this.addressLine1,
    this.addressLine2,
    this.city,
    this.state,
    this.postalCode,
    this.country,
  });

  String get addressLine {
    final parts = [
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
    ].whereType<String>().map((s) => s.trim()).where((s) => s.isNotEmpty);
    return parts.join(', ');
  }

  factory ContactInformation.fromJson(Map<String, dynamic> json) {
    return ContactInformation(
      phone: _str(json['phone']),
      email: _str(json['email']),
      addressLine1: _str(json['addressLine1']),
      addressLine2: _str(json['addressLine2']),
      city: _str(json['city']),
      state: _str(json['state']),
      postalCode: _str(json['postalCode']),
      country: _str(json['country']),
    );
  }
}

class EmergencyContact {
  final String? name;
  final String? relationship;
  final String? phone;
  final String? email;

  const EmergencyContact({
    this.name,
    this.relationship,
    this.phone,
    this.email,
  });

  factory EmergencyContact.fromJson(Map<String, dynamic> json) {
    return EmergencyContact(
      name: _str(json['name']),
      relationship: _str(json['relationship']),
      phone: _str(json['phone']),
      email: _str(json['email']),
    );
  }
}

class InsuranceRecord {
  final String? provider;
  final String? policyNumber;
  final String? memberId;
  final String? coverageType;
  final String? status;

  const InsuranceRecord({
    this.provider,
    this.policyNumber,
    this.memberId,
    this.coverageType,
    this.status,
  });

  factory InsuranceRecord.fromJson(Map<String, dynamic> json) {
    return InsuranceRecord(
      provider: _str(json['provider']),
      policyNumber: _str(json['policyNumber']),
      memberId: _str(json['memberId']),
      coverageType: _str(json['coverageType']),
      status: _str(json['status']),
    );
  }
}

class AllergyRecord {
  final String id;
  final String? allergen;
  final String? reaction;
  final String? severity;
  final String? recordedDate;

  const AllergyRecord({
    required this.id,
    this.allergen,
    this.reaction,
    this.severity,
    this.recordedDate,
  });

  factory AllergyRecord.fromJson(Map<String, dynamic> json) {
    return AllergyRecord(
      id: _str(json['id']) ?? '',
      allergen: _str(json['allergen']),
      reaction: _str(json['reaction']),
      severity: _str(json['severity']),
      recordedDate: _str(json['recordedDate']),
    );
  }
}

class ProblemRecord {
  final String id;
  final String? name;
  final String? icd10Code;
  final String? status;
  final String? diagnosedDate;

  const ProblemRecord({
    required this.id,
    this.name,
    this.icd10Code,
    this.status,
    this.diagnosedDate,
  });

  factory ProblemRecord.fromJson(Map<String, dynamic> json) {
    return ProblemRecord(
      id: _str(json['id']) ?? '',
      name: _str(json['name']),
      icd10Code: _str(json['icd10Code']),
      status: _str(json['status']),
      diagnosedDate: _str(json['diagnosedDate']),
    );
  }
}

class ConditionRecord {
  final String id;
  final String? name;
  final String? icd10Code;
  final String? status;
  final String? diagnosedDate;

  const ConditionRecord({
    required this.id,
    this.name,
    this.icd10Code,
    this.status,
    this.diagnosedDate,
  });

  factory ConditionRecord.fromJson(Map<String, dynamic> json) {
    return ConditionRecord(
      id: _str(json['id']) ?? '',
      name: _str(json['name']),
      icd10Code: _str(json['icd10Code']),
      status: _str(json['status']),
      diagnosedDate: _str(json['diagnosedDate']),
    );
  }
}

class MedicationRecord {
  final String id;
  final String? name;
  final String? dosage;
  final String? frequency;
  final String? route;
  final String? startDate;
  final String? status;
  final String? prescribedBy;

  const MedicationRecord({
    required this.id,
    this.name,
    this.dosage,
    this.frequency,
    this.route,
    this.startDate,
    this.status,
    this.prescribedBy,
  });

  factory MedicationRecord.fromJson(Map<String, dynamic> json) {
    return MedicationRecord(
      id: _str(json['id']) ?? '',
      name: _str(json['name']),
      dosage: _str(json['dosage']),
      frequency: _str(json['frequency']),
      route: _str(json['route']),
      startDate: _str(json['startDate']),
      status: _str(json['status']),
      prescribedBy: _str(json['prescribedBy']),
    );
  }
}

class EncounterRecord {
  final String id;
  final String? date;
  final String? type;
  final String? clinic;
  final String? provider;
  final String? reason;
  final List<String> diagnosis;
  final String? notes;

  const EncounterRecord({
    required this.id,
    this.date,
    this.type,
    this.clinic,
    this.provider,
    this.reason,
    this.diagnosis = const [],
    this.notes,
  });

  factory EncounterRecord.fromJson(Map<String, dynamic> json) {
    final dx = json['diagnosis'];
    return EncounterRecord(
      id: _str(json['id']) ?? '',
      date: _str(json['date']),
      type: _str(json['type']),
      clinic: _str(json['clinic']),
      provider: _str(json['provider']),
      reason: _str(json['reason']),
      diagnosis: dx is List
          ? dx.map((e) => e.toString()).where((e) => e.isNotEmpty).toList()
          : const [],
      notes: _str(json['notes']),
    );
  }
}

class VitalSignRecord {
  final String? date;
  final double? heightCm;
  final double? weightKg;
  final double? bmi;
  final String? bloodPressure;
  final double? heartRate;
  final double? respiratoryRate;
  final double? temperatureCelsius;
  final double? oxygenSaturation;
  final String? recordedBy;

  const VitalSignRecord({
    this.date,
    this.heightCm,
    this.weightKg,
    this.bmi,
    this.bloodPressure,
    this.heartRate,
    this.respiratoryRate,
    this.temperatureCelsius,
    this.oxygenSaturation,
    this.recordedBy,
  });

  factory VitalSignRecord.fromJson(Map<String, dynamic> json) {
    return VitalSignRecord(
      date: _str(json['date']),
      heightCm: _num(json['heightCm']),
      weightKg: _num(json['weightKg']),
      bmi: _num(json['bmi']),
      bloodPressure: _str(json['bloodPressure']),
      heartRate: _num(json['heartRate']),
      respiratoryRate: _num(json['respiratoryRate']),
      temperatureCelsius: _num(json['temperatureCelsius']),
      oxygenSaturation: _num(json['oxygenSaturation']),
      recordedBy: _str(json['recordedBy']),
    );
  }
}

class LabResultRecord {
  final String id;
  final String? testName;
  final String? result;
  final String? unit;
  final String? referenceRange;
  final String? status;
  final String? performedDate;

  const LabResultRecord({
    required this.id,
    this.testName,
    this.result,
    this.unit,
    this.referenceRange,
    this.status,
    this.performedDate,
  });

  factory LabResultRecord.fromJson(Map<String, dynamic> json) {
    return LabResultRecord(
      id: _str(json['id']) ?? '',
      testName: _str(json['testName']),
      result: _str(json['result']),
      unit: _str(json['unit']),
      referenceRange: _str(json['referenceRange']),
      status: _str(json['status']),
      performedDate: _str(json['performedDate']),
    );
  }
}

class ImmunizationRecord {
  final String id;
  final String? vaccine;
  final String? dateAdministered;
  final String? lotNumber;
  final String? administeredBy;

  const ImmunizationRecord({
    required this.id,
    this.vaccine,
    this.dateAdministered,
    this.lotNumber,
    this.administeredBy,
  });

  factory ImmunizationRecord.fromJson(Map<String, dynamic> json) {
    return ImmunizationRecord(
      id: _str(json['id']) ?? '',
      vaccine: _str(json['vaccine']),
      dateAdministered: _str(json['dateAdministered']),
      lotNumber: _str(json['lotNumber']),
      administeredBy: _str(json['administeredBy']),
    );
  }
}

class CarePlanRecord {
  final String id;
  final String? title;
  final List<String> goals;
  final String? startDate;
  final String? status;

  const CarePlanRecord({
    required this.id,
    this.title,
    this.goals = const [],
    this.startDate,
    this.status,
  });

  factory CarePlanRecord.fromJson(Map<String, dynamic> json) {
    final goals = json['goals'];
    return CarePlanRecord(
      id: _str(json['id']) ?? '',
      title: _str(json['title']),
      goals: goals is List
          ? goals.map((e) => e.toString()).where((e) => e.isNotEmpty).toList()
          : const [],
      startDate: _str(json['startDate']),
      status: _str(json['status']),
    );
  }
}

class ClinicalNoteRecord {
  final String id;
  final String? date;
  final String? author;
  final String? type;
  final String? content;

  const ClinicalNoteRecord({
    required this.id,
    this.date,
    this.author,
    this.type,
    this.content,
  });

  factory ClinicalNoteRecord.fromJson(Map<String, dynamic> json) {
    return ClinicalNoteRecord(
      id: _str(json['id']) ?? '',
      date: _str(json['date']),
      author: _str(json['author']),
      type: _str(json['type']),
      content: _str(json['content']),
    );
  }
}

class DocumentRecord {
  final String id;
  final String? type;
  final String? fileName;
  final String? uploadedBy;
  final String? uploadedAt;
  final String? status;

  const DocumentRecord({
    required this.id,
    this.type,
    this.fileName,
    this.uploadedBy,
    this.uploadedAt,
    this.status,
  });

  factory DocumentRecord.fromJson(Map<String, dynamic> json) {
    return DocumentRecord(
      id: _str(json['id']) ?? '',
      type: _str(json['type']),
      fileName: _str(json['fileName']),
      uploadedBy: _str(json['uploadedBy']),
      uploadedAt: _str(json['uploadedAt']),
      status: _str(json['status']),
    );
  }
}

class SyncMetadata {
  final String medicareUserId;
  final String openEmrPid;
  final String syncStatus;
  final String lastSyncAt;
  final String? lastVisitDate;

  const SyncMetadata({
    required this.medicareUserId,
    required this.openEmrPid,
    required this.syncStatus,
    required this.lastSyncAt,
    this.lastVisitDate,
  });

  factory SyncMetadata.fromJson(Map<String, dynamic> json) {
    return SyncMetadata(
      medicareUserId: _str(json['medicareUserId']) ?? '',
      openEmrPid: _str(json['openEmrPid']) ?? '',
      syncStatus: _str(json['syncStatus']) ?? '',
      lastSyncAt: _str(json['lastSyncAt']) ?? '',
      lastVisitDate: _str(json['lastVisitDate']),
    );
  }
}

class EmrSyncStatus {
  final String medicareUserId;
  final bool synced;
  final String? openemrPatientId;
  final String syncStatus;
  final String? lastError;
  final String updatedAt;
  final String? tenantId;

  const EmrSyncStatus({
    required this.medicareUserId,
    required this.synced,
    this.openemrPatientId,
    required this.syncStatus,
    this.lastError,
    required this.updatedAt,
    this.tenantId,
  });

  factory EmrSyncStatus.fromJson(Map<String, dynamic> json) {
    return EmrSyncStatus(
      medicareUserId: _str(json['medicareUserId']) ?? '',
      synced: json['synced'] == true,
      openemrPatientId: _str(json['openemrPatientId']),
      syncStatus: _str(json['syncStatus']) ?? 'PENDING',
      lastError: _str(json['lastError']),
      updatedAt: _str(json['updatedAt']) ?? '',
      tenantId: _str(json['tenantId']) ?? _str(json['clinicId']),
    );
  }
}

class EmrClinicLink {
  final String? tenantId;
  final String? clinicId;
  final bool synced;
  final String syncStatus;
  final String? openemrPatientId;
  final String? lastError;
  final String updatedAt;

  const EmrClinicLink({
    this.tenantId,
    this.clinicId,
    required this.synced,
    required this.syncStatus,
    this.openemrPatientId,
    this.lastError,
    required this.updatedAt,
  });

  String? get id => tenantId ?? clinicId;

  factory EmrClinicLink.fromJson(Map<String, dynamic> json) {
    return EmrClinicLink(
      tenantId: _str(json['tenantId']),
      clinicId: _str(json['clinicId']),
      synced: json['synced'] == true,
      syncStatus: _str(json['syncStatus']) ?? 'PENDING',
      openemrPatientId: _str(json['openemrPatientId']),
      lastError: _str(json['lastError']),
      updatedAt: _str(json['updatedAt']) ?? '',
    );
  }
}

String? _str(dynamic value) {
  if (value == null) return null;
  final s = value.toString().trim();
  return s.isEmpty ? null : s;
}

double? _num(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString());
}
