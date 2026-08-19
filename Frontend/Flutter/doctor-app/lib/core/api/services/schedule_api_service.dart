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

  Future<List<Map<String, dynamic>>> getClinicHours() async {
    final clinicId = _session.clinicId;
    if (clinicId == null) return const [];
    final response = await _client.get('/schedule/clinics/$clinicId/hours');
    final data = response.data as Map<String, dynamic>;
    final list = data['hours'] as List<dynamic>? ?? [];
    return list
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<String?> getClinicName() async {
    final clinicId = _session.clinicId;
    if (clinicId == null) return null;
    try {
      final response = await _client.get('/clinics/$clinicId');
      final data = response.data;
      if (data is! Map) return null;
      final map = Map<String, dynamic>.from(data);
      final clinic = map['clinic'] is Map
          ? Map<String, dynamic>.from(map['clinic'] as Map)
          : map;
      return clinic['name']?.toString() ?? clinic['clinicName']?.toString();
    } catch (_) {
      return null;
    }
  }

  Future<List<Map<String, dynamic>>> getMyBlockedTimes() async {
    try {
      final response = await _client.get('/schedule/me/blocked');
      return _parseBlocks(response.data);
    } catch (_) {
      final clinicId = _session.clinicId;
      final doctorId = _session.userId;
      if (clinicId == null || doctorId == null) return const [];
      try {
        final response = await _client.get(
          '/schedule/blocked',
          queryParameters: {
            'clinicId': clinicId,
            'doctorId': doctorId,
          },
        );
        return _parseBlocks(response.data);
      } catch (_) {
        return const [];
      }
    }
  }

  List<Map<String, dynamic>> _parseBlocks(dynamic data) {
    if (data is! Map) return const [];
    final list = data['blocks'] as List<dynamic>? ?? [];
    return list
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
}
