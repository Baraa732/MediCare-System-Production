import 'package:cms_doctor_app/core/api/api_client.dart';
import 'package:cms_doctor_app/core/storage/session_storage.dart';
import 'package:intl/intl.dart';

class DoctorAppointment {
  final String id;
  final String clinicId;
  final String doctorId;
  final String patientId;
  final DateTime scheduledAt;
  final int durationMinutes;
  final String status;
  final String? reason;
  final String? notes;
  final String? patientName;
  final String? patientGender;
  final String? patientBirthDate;
  final String? patientPhone;
  final String? clinicName;
  final String? guestPatientName;
  final String? guestPatientPhone;

  const DoctorAppointment({
    required this.id,
    required this.clinicId,
    required this.doctorId,
    required this.patientId,
    required this.scheduledAt,
    required this.durationMinutes,
    required this.status,
    this.reason,
    this.notes,
    this.patientName,
    this.patientGender,
    this.patientBirthDate,
    this.patientPhone,
    this.clinicName,
    this.guestPatientName,
    this.guestPatientPhone,
  });

  /// Manual / walk-in bookings have no registered MediCare patient account.
  bool get isGuestPatient => patientId.trim().isEmpty;

  /// Only registered patients have an OpenEMR chart.
  bool get hasEmr => patientId.trim().isNotEmpty;

  String get displayPatient {
    final registered = patientName?.trim();
    if (registered != null && registered.isNotEmpty) return registered;
    final guest = guestPatientName?.trim();
    if (guest != null && guest.isNotEmpty) return guest;
    return 'Patient';
  }

  String get timeLabel => DateFormat.jm().format(scheduledAt.toLocal());

  String get durationLabel => '$durationMinutes min';

  /// UI status labels used by the existing screens.
  String? get uiStatus {
    switch (status) {
      case 'COMPLETED':
        return 'Completed';
      case 'CONFIRMED':
        return 'Arrived';
      case 'REQUESTED':
        return null; // Pending
      case 'CANCELLED':
        return 'Cancelled';
      case 'NO_SHOW':
        return 'No show';
      default:
        return status;
    }
  }

  int? get ageYears {
    if (patientBirthDate == null || patientBirthDate!.isEmpty) return null;
    final dob = DateTime.tryParse(patientBirthDate!);
    if (dob == null) return null;
    final now = DateTime.now();
    var age = now.year - dob.year;
    if (now.month < dob.month ||
        (now.month == dob.month && now.day < dob.day)) {
      age--;
    }
    return age;
  }

  factory DoctorAppointment.fromJson(Map<String, dynamic> json) {
    final patientId = json['patientId']?.toString() ?? '';
    return DoctorAppointment(
      id: json['id']?.toString() ?? '',
      clinicId: json['clinicId']?.toString() ?? json['tenantId']?.toString() ?? '',
      doctorId: json['doctorId']?.toString() ?? '',
      patientId: patientId,
      scheduledAt: DateTime.tryParse(json['scheduledAt']?.toString() ?? '')?.toLocal() ??
          DateTime.now(),
      durationMinutes: int.tryParse(json['durationMinutes']?.toString() ?? '') ?? 30,
      status: json['status']?.toString() ?? 'REQUESTED',
      reason: json['reason']?.toString(),
      notes: json['notes']?.toString(),
      patientName: json['patientName']?.toString(),
      patientGender: json['patientGender']?.toString(),
      patientBirthDate: json['patientBirthDate']?.toString(),
      patientPhone: json['patientPhone']?.toString() ??
          json['guestPatientPhone']?.toString(),
      clinicName: json['clinicName']?.toString(),
      guestPatientName: json['guestPatientName']?.toString(),
      guestPatientPhone: json['guestPatientPhone']?.toString(),
    );
  }
}

class AppointmentApiService {
  AppointmentApiService(this._client, this._session);

  final ApiClient _client;
  final SessionStorage _session;

  Future<List<DoctorAppointment>> getMySchedule({
    DateTime? from,
    DateTime? to,
    String? status,
    String? patientId,
  }) async {
    final clinicId = _session.clinicId;
    final doctorId = _session.userId;
    if (clinicId == null || clinicId.isEmpty || doctorId == null) {
      throw Exception('Missing clinic session. Please log in again.');
    }

    final response = await _client.get(
      '/appointments',
      queryParameters: {
        'clinicId': clinicId,
        'doctorId': doctorId,
        if (from != null) 'from': from.toUtc().toIso8601String(),
        if (to != null) 'to': to.toUtc().toIso8601String(),
        if (status != null && status.isNotEmpty) 'status': status,
        if (patientId != null && patientId.isNotEmpty) 'patientId': patientId,
      },
    );
    final data = response.data as Map<String, dynamic>;
    final list = data['appointments'] as List<dynamic>? ?? [];
    return list
        .whereType<Map>()
        .map((e) => DoctorAppointment.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<DoctorAppointment> updateStatus(String id, String status) async {
    final response = await _client.patch(
      '/appointments/$id/status',
      data: {'status': status},
    );
    final data = response.data as Map<String, dynamic>;
    final json = data['appointment'] as Map<String, dynamic>? ?? data;
    return DoctorAppointment.fromJson(json);
  }

  Future<DoctorAppointment> updateNotes(String id, String notes) async {
    final response = await _client.put(
      '/appointments/$id',
      data: {'notes': notes},
    );
    final data = response.data as Map<String, dynamic>;
    final json = data['appointment'] as Map<String, dynamic>? ?? data;
    return DoctorAppointment.fromJson(json);
  }

  Future<List<DoctorAppointment>> getForPatient(String patientId) async {
    final now = DateTime.now();
    final list = await getMySchedule(
      from: now.subtract(const Duration(days: 730)),
      to: now.add(const Duration(days: 180)),
      patientId: patientId,
    );
    list.sort((a, b) => b.scheduledAt.compareTo(a.scheduledAt));
    return list;
  }

  Future<DoctorAppointment> reschedule(String id, DateTime scheduledAt) async {
    final response = await _client.put(
      '/appointments/$id',
      data: {'scheduledAt': scheduledAt.toUtc().toIso8601String()},
    );
    final data = response.data as Map<String, dynamic>;
    final json = data['appointment'] as Map<String, dynamic>? ?? data;
    return DoctorAppointment.fromJson(json);
  }
}
