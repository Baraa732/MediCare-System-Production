import 'package:cms/core/entities/alert.dart';
import 'package:cms/core/entities/appointment.dart';
import 'package:cms/core/entities/clinic.dart';
import 'package:cms/core/entities/doctor.dart';
import 'package:cms/core/entities/notifications.dart';
import 'package:cms/core/utils/media_url.dart';
import 'package:intl/intl.dart';

class EntityMappers {
  static Clinic clinicFromJson(Map<String, dynamic> json) {
    final city = json['city']?.toString() ?? '';
    final governorate = json['governorate']?.toString() ?? '';
    final address = json['address']?.toString() ?? '';
    final locationParts = [address, city, governorate]
        .where((p) => p.isNotEmpty)
        .toList();

    final lat = _toDouble(json['latitude']);
    final lng = _toDouble(json['longitude']);

    return Clinic(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Clinic',
      specialty: json['specialization']?.toString() ??
          (json['description']?.toString().isNotEmpty == true
              ? json['description']?.toString()
              : null) ??
          'General Medicine',
      location: locationParts.isNotEmpty
          ? locationParts.join(', ')
          : (json['location']?.toString() ?? json['name']?.toString() ?? '—'),
      hours: json['hours']?.toString() ?? json['timezone']?.toString() ?? '—',
      latitude: lat,
      longitude: lng,
      rating: _toDouble(json['rating']) ?? 4.5,
      isSaved: json['isSaved'] == true,
      imageUrl: MediaUrl.resolve(json['logoUrl']?.toString()),
      description: json['description']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      address: address,
      city: city,
      governorate: governorate,
    );
  }

  static Doctor doctorFromJson(Map<String, dynamic> json, {String? fallbackImage}) {
    final first = json['firstName']?.toString() ?? '';
    final last = json['lastName']?.toString() ?? '';
    final full = json['fullName']?.toString() ??
        [first, last].where((p) => p.isNotEmpty).join(' ');

    return Doctor(
      id: json['userId']?.toString() ?? json['id']?.toString() ?? '',
      name: full.isNotEmpty ? full : 'Doctor',
      experience: json['yearsOfExperience'] != null
          ? '${json['yearsOfExperience']} years'
          : '—',
      specialty: json['specialization']?.toString() ?? 'General',
      imageUrl: MediaUrl.resolve(
        json['avatarUrl']?.toString() ?? fallbackImage,
      ),
    );
  }

  static Appointment appointmentFromJson(Map<String, dynamic> json) {
    final scheduledAt = json['scheduledAt']?.toString();
    DateTime? dt;
    if (scheduledAt != null) {
      dt = DateTime.tryParse(scheduledAt)?.toLocal();
    }

    final doctor = json['doctor'] as Map<String, dynamic>?;
    final clinic = json['clinic'] as Map<String, dynamic>?;

    final doctorFirst = doctor?['firstName']?.toString() ?? '';
    final doctorLast = doctor?['lastName']?.toString() ?? '';
    final doctorName = doctor?['fullName']?.toString() ??
        json['doctorName']?.toString() ??
        [doctorFirst, doctorLast].where((p) => p.isNotEmpty).join(' ');

    final clinicName = clinic?['name']?.toString() ??
        json['clinicName']?.toString() ??
        'Clinic';
    final addressParts = [
      json['clinicAddress']?.toString() ?? clinic?['address']?.toString() ?? '',
      json['clinicCity']?.toString() ?? clinic?['city']?.toString() ?? '',
      json['clinicGovernorate']?.toString() ??
          clinic?['governorate']?.toString() ??
          '',
    ].where((p) => p.trim().isNotEmpty).toList();

    return Appointment(
      id: json['id']?.toString() ?? '',
      doctorName: doctorName.isNotEmpty ? doctorName : 'Doctor',
      specialty: doctor?['specialization']?.toString() ??
          json['doctorSpecialization']?.toString() ??
          '—',
      clinicName: clinicName,
      clinicId: json['clinicId']?.toString() ??
          json['tenantId']?.toString() ??
          clinic?['id']?.toString() ??
          '',
      doctorId: json['doctorId']?.toString() ??
          doctor?['id']?.toString() ??
          doctor?['userId']?.toString() ??
          '',
      date: dt != null ? DateFormat('d/M/yyyy').format(dt) : '—',
      time: dt != null ? DateFormat('h:mm a').format(dt) : '—',
      status: _mapAppointmentStatus(json['status']?.toString()),
      followUp: json['reason']?.toString(),
      scheduledAt: dt,
      clinicAddress: addressParts.join(', '),
    );
  }

  static String _mapAppointmentStatus(String? status) {
    switch (status?.toUpperCase()) {
      case 'CONFIRMED':
        return 'Confirmed';
      case 'REQUESTED':
        return 'Pending';
      case 'COMPLETED':
        return 'Done';
      case 'CANCELLED':
        return 'Cancelled';
      case 'NO_SHOW':
        return 'No show';
      case 'RESCHEDULED':
        return 'Rescheduled';
      default:
        return status ?? 'Pending';
    }
  }

  static NotificationItem notificationFromJson(Map<String, dynamic> json) {
    final typeRaw =
        (json['type'] ?? json['category'] ?? 'SYSTEM').toString().toUpperCase();
    final createdAt = json['createdAt']?.toString();
    final readAtRaw = json['readAt']?.toString();
    final dt =
        createdAt != null ? DateTime.tryParse(createdAt)?.toLocal() : null;
    final readAt =
        readAtRaw != null ? DateTime.tryParse(readAtRaw)?.toLocal() : null;
    final title =
        json['title']?.toString().trim().isNotEmpty == true
            ? json['title'].toString()
            : _notificationTitle(typeRaw);
    final body =
        json['body']?.toString().trim().isNotEmpty == true
            ? json['body'].toString()
            : 'MediCare notification';

    return NotificationItem(
      id: json['id']?.toString() ?? '',
      title: title,
      body: body,
      typeText: _friendlyTypeLabel(typeRaw),
      time: dt != null ? _relativeTime(dt) : 'Recently',
      type: readAt != null ? NotificationType.read : _notificationType(typeRaw),
      readAt: readAt,
      createdAt: dt,
    );
  }

  static String _friendlyTypeLabel(String type) {
    switch (type) {
      case 'APPOINTMENT_REMINDER':
        return 'Reminder';
      case 'APPOINTMENT_CONFIRMED':
        return 'Confirmed';
      case 'APPOINTMENT_CANCELLED':
        return 'Cancelled';
      case 'APPOINTMENT_RESCHEDULED':
        return 'Rescheduled';
      case 'LATE_ARRIVAL':
        return 'Alert';
      case 'SYSTEM':
        return 'Update';
      default:
        return 'Update';
    }
  }

  static Alert alertFromNotification(NotificationItem item) {
    return Alert(
      id: item.id,
      time: item.time,
      message: item.title,
      isLate: item.type == NotificationType.alert,
    );
  }

  static String _notificationTitle(String type) {
    switch (type) {
      case 'APPOINTMENT_REMINDER':
        return 'Appointment reminder';
      case 'APPOINTMENT_CONFIRMED':
        return 'Appointment confirmed';
      case 'APPOINTMENT_CANCELLED':
        return 'Appointment cancelled';
      case 'LATE_ARRIVAL':
        return 'You\'re late for your appointment';
      default:
        return 'MediCare update';
    }
  }

  static NotificationType _notificationType(String type) {
    switch (type) {
      case 'APPOINTMENT_CONFIRMED':
        return NotificationType.success;
      case 'LATE_ARRIVAL':
        return NotificationType.alert;
      case 'APPOINTMENT_CANCELLED':
        return NotificationType.warning;
      default:
        return NotificationType.system;
    }
  }

  static String _relativeTime(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'Now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} hour${diff.inHours == 1 ? '' : 's'} ago';
    if (diff.inDays < 7) return '${diff.inDays} day${diff.inDays == 1 ? '' : 's'} ago';
    return DateFormat('d MMM yyyy').format(dt);
  }

  static double? _toDouble(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString());
  }
}
