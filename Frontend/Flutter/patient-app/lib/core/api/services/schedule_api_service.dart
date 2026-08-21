import 'package:cms/core/api/api_client.dart';

class AvailableSlotsResult {
  const AvailableSlotsResult({
    required this.slots,
    this.closed = false,
  });

  final List<DateTime> slots;
  final bool closed;
}

class ScheduleApiService {
  ScheduleApiService(this._client);

  final ApiClient _client;

  /// Returns available slot start times (UTC ISO strings) for a doctor on [date] (yyyy-MM-dd).
  /// Omits [durationMinutes] when using the server default (30) so query validation stays clean.
  Future<AvailableSlotsResult> getAvailableSlots({
    required String clinicId,
    required String doctorId,
    required DateTime date,
    int? durationMinutes,
  }) async {
    final dateKey =
        '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    final query = <String, dynamic>{
      'clinicId': clinicId,
      'doctorId': doctorId,
      'date': dateKey,
    };
    if (durationMinutes != null) {
      query['durationMinutes'] = durationMinutes;
    }
    final response = await _client.get(
      '/schedule/slots',
      queryParameters: query,
    );
    final data = response.data as Map<String, dynamic>;
    final list = data['slots'] as List<dynamic>? ?? [];
    final closed = data['closed'] == true;
    final slots = list
        .map((s) => DateTime.tryParse(s.toString())?.toLocal())
        .whereType<DateTime>()
        .toList();
    return AvailableSlotsResult(slots: slots, closed: closed);
  }

  /// Weekly clinic hours (0=Sun … 6=Sat). Used to label closed weekdays in booking UI.
  Future<List<Map<String, dynamic>>> getClinicHours(String clinicId) async {
    final response = await _client.get('/schedule/clinics/$clinicId/hours');
    final data = response.data as Map<String, dynamic>;
    final list = data['hours'] as List<dynamic>? ?? [];
    return list
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
}
