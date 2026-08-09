import 'package:cms/core/api/api_client.dart';
import 'package:cms/core/entities/patient_emr.dart';

/// Patient EMR via MediCare gateway → OpenEMR FHIR R4 chart.
///
/// Each authenticated patient only ever receives their own chart
/// (`GET /emr/me`). Optional `tenantId` selects a clinic-specific chart
/// when the patient has links at multiple clinics.
class EmrApiService {
  EmrApiService(this._client);

  final ApiClient _client;

  Future<PatientEmrChart> getMyEmr({String? tenantId}) async {
    final response = await _client.get(
      '/emr/me',
      queryParameters: {
        if (tenantId != null && tenantId.isNotEmpty) 'tenantId': tenantId,
      },
    );
    final data = response.data;
    if (data is Map<String, dynamic>) {
      return PatientEmrChart.fromJson(data);
    }
    throw Exception('Invalid EMR response');
  }

  Future<EmrSyncStatus> getMySyncStatus({String? tenantId}) async {
    final response = await _client.get(
      '/emr/me/sync-status',
      queryParameters: {
        if (tenantId != null && tenantId.isNotEmpty) 'tenantId': tenantId,
      },
    );
    final data = response.data;
    if (data is Map<String, dynamic>) {
      return EmrSyncStatus.fromJson(data);
    }
    throw Exception('Invalid EMR sync-status response');
  }

  Future<List<EmrClinicLink>> getMyLinks() async {
    final response = await _client.get('/emr/me/links');
    final data = response.data;
    if (data is Map<String, dynamic>) {
      final list = data['links'];
      if (list is List) {
        return list
            .whereType<Map>()
            .map((e) => EmrClinicLink.fromJson(Map<String, dynamic>.from(e)))
            .toList(growable: false);
      }
    }
    return const [];
  }
}
