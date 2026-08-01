import 'package:cms/core/api/api_client.dart';

class ScheduleApiService {
  ScheduleApiService(this._client);

  final ApiClient _client;

  /// Returns available slot start times (UTC ISO strings) for a doctor on [date] (yyyy-MM-dd).
  Future<List<DateTime>> getAvailableSlots({
    required String clinicId,
    required String doctorId,
    required DateTime date,
    int durationMinutes = 30,
  }) async {
    final dateKey =
        '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    final response = await _client.get(
      '/schedule/slots',
      queryParameters: {
        'clinicId': clinicId,
        'doctorId': doctorId,
        'date': dateKey,
        'durationMinutes': durationMinutes,
      },
    );
    final data = response.data as Map<String, dynamic>;
    final list = data['slots'] as List<dynamic>? ?? [];
    return list
        .map((s) => DateTime.tryParse(s.toString())?.toLocal())
        .whereType<DateTime>()
        .toList();
  }
}
