import 'package:cms_doctor_app/core/api/api_client.dart';

class PatientEmrChart {
  final Map<String, dynamic> patient;
  final List<Map<String, dynamic>> allergies;
  final List<Map<String, dynamic>> medications;
  final List<Map<String, dynamic>> conditions;
  final List<Map<String, dynamic>> problems;
  final List<Map<String, dynamic>> encounters;
  final List<Map<String, dynamic>> vitalSigns;
  final List<Map<String, dynamic>> labResults;
  final List<Map<String, dynamic>> immunizations;
  final List<Map<String, dynamic>> carePlans;
  final List<Map<String, dynamic>> clinicalNotes;
  final List<Map<String, dynamic>> documents;
  final Map<String, dynamic> contactInformation;
  final List<Map<String, dynamic>> emergencyContacts;

  const PatientEmrChart({
    required this.patient,
    required this.allergies,
    required this.medications,
    required this.conditions,
    required this.problems,
    required this.encounters,
    required this.vitalSigns,
    required this.labResults,
    required this.immunizations,
    required this.carePlans,
    required this.clinicalNotes,
    required this.documents,
    this.contactInformation = const {},
    this.emergencyContacts = const [],
  });

  factory PatientEmrChart.fromJson(Map<String, dynamic> json) {
    List<Map<String, dynamic>> list(String key) {
      final raw = json[key];
      if (raw is! List) return const [];
      return raw
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }

    final conditions = list('conditions');
    final problems = list('problems');
    return PatientEmrChart(
      patient: Map<String, dynamic>.from(json['patient'] as Map? ?? const {}),
      allergies: list('allergies'),
      medications: list('medications'),
      conditions: conditions.isEmpty ? problems : conditions,
      problems: problems,
      encounters: list('encounters'),
      vitalSigns: list('vitalSigns'),
      labResults: list('labResults'),
      immunizations: list('immunizations'),
      carePlans: list('carePlans'),
      clinicalNotes: list('clinicalNotes'),
      documents: list('documents'),
      contactInformation: Map<String, dynamic>.from(
        json['contactInformation'] as Map? ?? const {},
      ),
      emergencyContacts: list('emergencyContacts'),
    );
  }

  PatientEmrChart copyWith({
    Map<String, dynamic>? patient,
    List<Map<String, dynamic>>? allergies,
    List<Map<String, dynamic>>? medications,
    List<Map<String, dynamic>>? conditions,
    List<Map<String, dynamic>>? problems,
    List<Map<String, dynamic>>? encounters,
    List<Map<String, dynamic>>? vitalSigns,
    List<Map<String, dynamic>>? labResults,
    List<Map<String, dynamic>>? immunizations,
    List<Map<String, dynamic>>? carePlans,
    List<Map<String, dynamic>>? clinicalNotes,
    List<Map<String, dynamic>>? documents,
    Map<String, dynamic>? contactInformation,
    List<Map<String, dynamic>>? emergencyContacts,
  }) {
    return PatientEmrChart(
      patient: patient ?? this.patient,
      allergies: allergies ?? this.allergies,
      medications: medications ?? this.medications,
      conditions: conditions ?? this.conditions,
      problems: problems ?? this.problems,
      encounters: encounters ?? this.encounters,
      vitalSigns: vitalSigns ?? this.vitalSigns,
      labResults: labResults ?? this.labResults,
      immunizations: immunizations ?? this.immunizations,
      carePlans: carePlans ?? this.carePlans,
      clinicalNotes: clinicalNotes ?? this.clinicalNotes,
      documents: documents ?? this.documents,
      contactInformation: contactInformation ?? this.contactInformation,
      emergencyContacts: emergencyContacts ?? this.emergencyContacts,
    );
  }

  String get fullName {
    final first = patient['firstName']?.toString() ?? '';
    final last = patient['lastName']?.toString() ?? '';
    return '$first $last'.trim();
  }
}

class EmrApiService {
  EmrApiService(this._client);

  final ApiClient _client;

  Future<PatientEmrChart> getPatientEmr(String userId) async {
    final response = await _client.get('/emr/patients/$userId');
    return _parseChart(response.data);
  }

  Future<Map<String, dynamic>> ensurePatientEmr(
    String userId, {
    Map<String, dynamic>? profileHint,
  }) async {
    final response = await _client.post(
      '/emr/patients/$userId/ensure',
      data: profileHint ?? const {},
    );
    final data = response.data;
    if (data is Map<String, dynamic>) return data;
    return const {};
  }

  Future<Map<String, dynamic>> addClinicalNote(
    String userId, {
    required String content,
    String? type,
  }) async {
    final response = await _client.post(
      '/emr/patients/$userId/clinical-notes',
      data: {
        'content': content,
        if (type != null && type.trim().isNotEmpty) 'type': type.trim(),
      },
    );
    final data = response.data;
    if (data is Map<String, dynamic>) return data;
    return const {};
  }

  Future<PatientEmrChart> addAllergy(
    String userId, {
    required String allergen,
    String? reaction,
    String? severity,
  }) async {
    final response = await _client.post(
      '/emr/patients/$userId/allergies',
      data: {
        'allergen': allergen,
        if (reaction != null) 'reaction': reaction,
        if (severity != null) 'severity': severity,
      },
    );
    return _parseChart(response.data);
  }

  Future<PatientEmrChart> addMedication(
    String userId, {
    required String name,
    String? dosage,
    String? frequency,
    String? route,
  }) async {
    final response = await _client.post(
      '/emr/patients/$userId/medications',
      data: {
        'name': name,
        if (dosage != null) 'dosage': dosage,
        if (frequency != null) 'frequency': frequency,
        if (route != null) 'route': route,
      },
    );
    return _parseChart(response.data);
  }

  Future<PatientEmrChart> addCondition(
    String userId, {
    required String name,
    String? icd10Code,
    String? status,
  }) async {
    final response = await _client.post(
      '/emr/patients/$userId/conditions',
      data: {
        'name': name,
        if (icd10Code != null) 'icd10Code': icd10Code,
        if (status != null) 'status': status,
      },
    );
    return _parseChart(response.data);
  }

  Future<PatientEmrChart> addVital(
    String userId, {
    String? bloodPressure,
    double? heartRate,
    double? temperatureCelsius,
    double? oxygenSaturation,
    double? weightKg,
    double? heightCm,
  }) async {
    final response = await _client.post(
      '/emr/patients/$userId/vitals',
      data: {
        if (bloodPressure != null) 'bloodPressure': bloodPressure,
        if (heartRate != null) 'heartRate': heartRate,
        if (temperatureCelsius != null) 'temperatureCelsius': temperatureCelsius,
        if (oxygenSaturation != null) 'oxygenSaturation': oxygenSaturation,
        if (weightKg != null) 'weightKg': weightKg,
        if (heightCm != null) 'heightCm': heightCm,
      },
    );
    return _parseChart(response.data);
  }

  Future<PatientEmrChart> addLabResult(
    String userId, {
    required String testName,
    String? result,
    String? unit,
    String? referenceRange,
    String? status,
  }) async {
    final response = await _client.post(
      '/emr/patients/$userId/lab-results',
      data: {
        'testName': testName,
        if (result != null) 'result': result,
        if (unit != null) 'unit': unit,
        if (referenceRange != null) 'referenceRange': referenceRange,
        if (status != null) 'status': status,
      },
    );
    return _parseChart(response.data);
  }

  Future<PatientEmrChart> addCarePlan(
    String userId, {
    required String title,
    String? goals,
    String? status,
  }) async {
    final response = await _client.post(
      '/emr/patients/$userId/care-plans',
      data: {
        'title': title,
        if (goals != null) 'goals': goals,
        if (status != null) 'status': status,
      },
    );
    return _parseChart(response.data);
  }

  PatientEmrChart _parseChart(dynamic data) {
    if (data is Map<String, dynamic>) {
      final chart = data['chart'];
      if (chart is Map) {
        return PatientEmrChart.fromJson(Map<String, dynamic>.from(chart));
      }
      return PatientEmrChart.fromJson(data);
    }
    throw Exception('Invalid EMR response');
  }
}
