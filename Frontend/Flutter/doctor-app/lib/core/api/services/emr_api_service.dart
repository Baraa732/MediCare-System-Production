import 'package:cms_doctor_app/core/api/api_client.dart';

class PatientEmrChart {
  final Map<String, dynamic> patient;
  final List<Map<String, dynamic>> allergies;
  final List<Map<String, dynamic>> medications;
  final List<Map<String, dynamic>> conditions;
  final List<Map<String, dynamic>> encounters;
  final List<Map<String, dynamic>> vitalSigns;
  final List<Map<String, dynamic>> labResults;
  final List<Map<String, dynamic>> immunizations;
  final List<Map<String, dynamic>> clinicalNotes;

  const PatientEmrChart({
    required this.patient,
    required this.allergies,
    required this.medications,
    required this.conditions,
    required this.encounters,
    required this.vitalSigns,
    required this.labResults,
    required this.immunizations,
    required this.clinicalNotes,
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

    return PatientEmrChart(
      patient: Map<String, dynamic>.from(json['patient'] as Map? ?? const {}),
      allergies: list('allergies'),
      medications: list('medications'),
      conditions: list('conditions'),
      encounters: list('encounters'),
      vitalSigns: list('vitalSigns'),
      labResults: list('labResults'),
      immunizations: list('immunizations'),
      clinicalNotes: list('clinicalNotes'),
    );
  }

  PatientEmrChart copyWith({
    Map<String, dynamic>? patient,
    List<Map<String, dynamic>>? allergies,
    List<Map<String, dynamic>>? medications,
    List<Map<String, dynamic>>? conditions,
    List<Map<String, dynamic>>? encounters,
    List<Map<String, dynamic>>? vitalSigns,
    List<Map<String, dynamic>>? labResults,
    List<Map<String, dynamic>>? immunizations,
    List<Map<String, dynamic>>? clinicalNotes,
  }) {
    return PatientEmrChart(
      patient: patient ?? this.patient,
      allergies: allergies ?? this.allergies,
      medications: medications ?? this.medications,
      conditions: conditions ?? this.conditions,
      encounters: encounters ?? this.encounters,
      vitalSigns: vitalSigns ?? this.vitalSigns,
      labResults: labResults ?? this.labResults,
      immunizations: immunizations ?? this.immunizations,
      clinicalNotes: clinicalNotes ?? this.clinicalNotes,
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

  /// Create / repair OpenEMR chart link for this clinic patient.
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
