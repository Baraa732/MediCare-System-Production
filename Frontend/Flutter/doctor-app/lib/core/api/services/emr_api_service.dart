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
    final data = response.data;
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
