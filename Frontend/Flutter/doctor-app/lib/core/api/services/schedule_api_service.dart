import 'package:cms_doctor_app/core/api/api_client.dart';
import 'package:cms_doctor_app/core/storage/session_storage.dart';

class ScheduleApiService {
  ScheduleApiService(this._client, this._session);

  final ApiClient _client;
  final SessionStorage _session;

  Future<List<Map<String, dynamic>>> getMyAvailability() async {
    final clinicId = _session.clinicId;
    final doctorId = _session.userId;
    if (clinicId == null || doctorId == null) return const [];
    final response = await _client.get(
      '/schedule/availability',
      queryParameters: {
        'clinicId': clinicId,
        'doctorId': doctorId,
      },
    );
    final data = response.data as Map<String, dynamic>;
    final list = data['availability'] as List<dynamic>? ?? [];
    return list
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  /// Doctor leave / unavailability — creates a schedule block for self.
  Future<void> requestLeave({
    required DateTime startsAt,
    required DateTime endsAt,
    required String reason,
  }) async {
    final clinicId = _session.clinicId;
    if (clinicId == null) {
      throw Exception('Missing clinic session');
    }
    await _client.post(
      '/schedule/blocked',
      data: {
        'clinicId': clinicId,
        'doctorId': _session.userId,
        'startsAt': startsAt.toUtc().toIso8601String(),
        'endsAt': endsAt.toUtc().toIso8601String(),
        'reason': reason,
      },
    );
  }
}
