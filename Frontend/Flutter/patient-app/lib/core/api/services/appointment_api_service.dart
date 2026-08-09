import 'package:cms/core/api/api_client.dart';
import 'package:cms/core/api/entity_mappers.dart';
import 'package:cms/core/entities/appointment.dart';
import 'package:dio/dio.dart';

class AppointmentApiService {
  AppointmentApiService(this._client);

  final ApiClient _client;

  Future<List<Appointment>> getMyAppointments({
    String? status,
    String? group,
  }) async {
    final response = await _client.get(
      '/appointments/me',
      queryParameters: {
        if (status != null && status.isNotEmpty) 'status': status,
        if (group != null && group.isNotEmpty) 'group': group,
      },
    );
    final data = response.data as Map<String, dynamic>;
    final list = data['appointments'] as List<dynamic>? ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(EntityMappers.appointmentFromJson)
        .toList();
  }

  Future<Appointment> getAppointment(String id) async {
    final response = await _client.get('/appointments/$id');
    final data = response.data as Map<String, dynamic>;
    final json =
        data['appointment'] as Map<String, dynamic>? ?? data;
    return EntityMappers.appointmentFromJson(json);
  }

  Future<Appointment> bookAppointment({
    required String clinicId,
    required String doctorId,
    required DateTime scheduledAt,
    int durationMinutes = 30,
    String? reason,
  }) async {
    final response = await _client.post(
      '/appointments',
      data: {
        'clinicId': clinicId,
        'doctorId': doctorId,
        'scheduledAt': scheduledAt.toUtc().toIso8601String(),
        'durationMinutes': durationMinutes,
        if (reason != null && reason.isNotEmpty) 'reason': reason,
      },
      options: Options(
        headers: {'Idempotency-Key': newIdempotencyKey()},
      ),
    );
    final data = response.data as Map<String, dynamic>;
    final appointmentJson = data['appointment'];
    if (appointmentJson is Map<String, dynamic>) {
      return EntityMappers.appointmentFromJson(appointmentJson);
    }
    // Some gateways wrap as { success, data: { appointment } }
    final nested = data['data'];
    if (nested is Map<String, dynamic>) {
      final inner = nested['appointment'];
      if (inner is Map<String, dynamic>) {
        return EntityMappers.appointmentFromJson(inner);
      }
    }
    // Booking succeeded even if enrichment shape differs.
    return EntityMappers.appointmentFromJson({
      'id': data['id']?.toString() ?? '',
      'clinicId': clinicId,
      'doctorId': doctorId,
      'scheduledAt': scheduledAt.toUtc().toIso8601String(),
      'status': 'REQUESTED',
      'reason': reason,
    });
  }

  Future<void> cancelAppointment(String id, {String? reason}) async {
    await _client.patch(
      '/appointments/$id/status',
      data: {
        'status': 'CANCELLED',
        if (reason != null && reason.isNotEmpty) 'cancellationReason': reason,
      },
    );
  }
}
