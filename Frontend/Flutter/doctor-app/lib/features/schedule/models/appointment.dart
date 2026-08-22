import 'package:cms_doctor_app/core/api/services/appointment_api_service.dart';
import 'package:cms_doctor_app/core/utils/appointment_notes_util.dart';
import 'package:cms_doctor_app/features/patients/patient_record_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../core/constants/app_assets.dart';
import '../../../core/widgets/common_widgets.dart';

enum FollowUp { no, yes, yesIn }

class Appointment {
  const Appointment({
    required this.id,
    required this.patientId,
    required this.time,
    required this.duration,
    required this.patient,
    required this.status,
    required this.tags,
    required this.hasNotes,
    required this.color,
    required this.scheduledAt,
    this.notes,
    this.storedNotes,
    this.rawStatus,
    this.gender,
    this.age,
    this.avatarUrl,
  });

  final String id;
  final String patientId;
  final String time;
  final String duration;
  final String patient;
  final String? status;
  final List<String> tags;
  final bool hasNotes;
  final Color color;
  final DateTime scheduledAt;
  final String? notes;
  final String? storedNotes;
  final String? rawStatus;
  final String? gender;
  final int? age;
  final String? avatarUrl;

  factory Appointment.fromDoctor(DoctorAppointment a) {
    Color color = const Color(0xFFEEF4FF);
    if (a.status == 'COMPLETED') color = const Color(0xFFF5F5F5);
    if (a.status == 'REQUESTED') color = const Color(0xFFFFF9E6);
    if (a.status == 'NO_SHOW' || a.status == 'CANCELLED') {
      color = const Color(0xFFF5F5F5);
    }
    final tags = <String>[
      if (a.reason != null && a.reason!.trim().isNotEmpty) a.reason!.trim(),
    ];
    return Appointment(
      id: a.id,
      patientId: a.patientId,
      time: a.timeLabel,
      duration: a.durationLabel,
      patient: a.displayPatient,
      status: a.uiStatus,
      tags: tags.isEmpty ? const ['Visit'] : tags,
      hasNotes: hasDisplayNotes(a.storedNotes),
      notes: a.notes,
      storedNotes: a.storedNotes,
      color: color,
      rawStatus: a.status,
      scheduledAt: a.scheduledAt,
      gender: a.patientGender,
      age: a.ageYears,
      avatarUrl: a.patientAvatarUrl,
    );
  }

  Appointment copyWith({
    String? id,
    String? patientId,
    String? time,
    String? duration,
    String? patient,
    String? status,
    List<String>? tags,
    bool? hasNotes,
    Color? color,
    String? notes,
    String? storedNotes,
    String? rawStatus,
    DateTime? scheduledAt,
    String? gender,
    int? age,
    String? avatarUrl,
  }) {
    return Appointment(
      id: id ?? this.id,
      patientId: patientId ?? this.patientId,
      time: time ?? this.time,
      duration: duration ?? this.duration,
      patient: patient ?? this.patient,
      status: status ?? this.status,
      tags: tags ?? this.tags,
      hasNotes: hasNotes ?? this.hasNotes,
      color: color ?? this.color,
      notes: notes ?? this.notes,
      storedNotes: storedNotes ?? this.storedNotes,
      rawStatus: rawStatus ?? this.rawStatus,
      scheduledAt: scheduledAt ?? this.scheduledAt,
      gender: gender ?? this.gender,
      age: age ?? this.age,
      avatarUrl: avatarUrl ?? this.avatarUrl,
    );
  }
}

class AppointmentCard extends StatelessWidget {
  const AppointmentCard({
    super.key,
    required this.appointment,
    required this.onComplete,
    required this.onReschedule,
    this.onMarkArrived,
    this.onNoShow,
    this.onCancel,
  });

  final Appointment appointment;
  final VoidCallback onComplete;
  final VoidCallback onReschedule;
  final VoidCallback? onMarkArrived;
  final VoidCallback? onNoShow;
  final VoidCallback? onCancel;

  @override
  Widget build(BuildContext context) {
    Color statusColor = const Color(0xFF929296);
    if (appointment.status == 'Completed') statusColor = const Color(0xFF4CAF50);
    if (appointment.status == 'Arrived') statusColor = const Color(0xFF0B74FA);
    if (appointment.status == 'No show') statusColor = const Color(0xFFE53935);
    if (appointment.status == 'Cancelled') statusColor = const Color(0xFF929296);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: appointment.color,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: Colors.white.withValues(alpha: 0.7)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => PatientRecordScreen(
                patientId: appointment.patientId,
                patientName: appointment.patient,
                gender: appointment.gender,
                age: appointment.age,
                avatarUrl: appointment.avatarUrl,
                appointmentId: appointment.id,
                appointmentTime: appointment.time,
                appointmentDuration: appointment.duration,
                appointmentStatus: appointment.status ?? 'Pending',
                appointmentReason:
                    appointment.tags.isNotEmpty ? appointment.tags.first : null,
                appointmentNotes: appointment.notes,
                appointmentStoredNotes: appointment.storedNotes,
                isGuestPatient: appointment.patientId.trim().isEmpty,
              ),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(appointment.time,
                            style: const TextStyle(
                                fontSize: 13, color: Color(0xFF929296))),
                        Text(appointment.duration,
                            style: const TextStyle(
                                fontSize: 12, color: Color(0xFF929296))),
                      ],
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        appointment.patient,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1A1B1E),
                        ),
                      ),
                    ),
                    if (appointment.status != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: statusColor,
                          borderRadius: BorderRadius.circular(29),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (appointment.status == 'Completed') ...[
                              SvgPicture.asset(AppAssets.completed,
                                  width: 12, height: 12),
                              const SizedBox(width: 4),
                            ],
                            Text(
                              appointment.status!,
                              style: const TextStyle(
                                  fontSize: 12, color: Colors.white),
                            ),
                          ],
                        ),
                      ),
                    const Icon(Icons.chevron_right, color: Color(0xFF929296)),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  children: appointment.tags
                      .map(
                        (tag) => Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0B74FA).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(29),
                          ),
                          child: Text(
                            tag,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF0B74FA),
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
                if (appointment.hasNotes) ...[
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFDE7),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        noteLabel('Notes'),
                        Text(
                          appointment.notes ?? '',
                          style: const TextStyle(
                              fontSize: 13, color: Color(0xFF1A1B1E)),
                        ),
                      ],
                    ),
                  ),
                ],
                if (appointment.status != 'Completed' &&
                    appointment.status != 'Cancelled' &&
                    appointment.status != 'No show') ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      if (appointment.status == null && onMarkArrived != null) ...[
                        Expanded(
                          child: OutlinedButton(
                            onPressed: onMarkArrived,
                            style: OutlinedButton.styleFrom(
                              side: const BorderSide(color: Color(0xFF0B74FA)),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8)),
                            ),
                            child: const Text('Arrived',
                                style: TextStyle(
                                    color: Color(0xFF0B74FA), fontSize: 14)),
                          ),
                        ),
                        const SizedBox(width: 8),
                      ],
                      Expanded(
                        child: ElevatedButton(
                          onPressed: onComplete,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0B74FA),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8)),
                          ),
                          child: const Text('Complete',
                              style:
                                  TextStyle(color: Colors.white, fontSize: 14)),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: onReschedule,
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Color(0xFF0B74FA)),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8)),
                          ),
                          child: const Text('Reschedule',
                              style: TextStyle(
                                  color: Color(0xFF0B74FA), fontSize: 13)),
                        ),
                      ),
                    ],
                  ),
                  if (onNoShow != null) ...[
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: onNoShow,
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFFE53935)),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8)),
                        ),
                        child: const Text('No show',
                            style: TextStyle(
                                color: Color(0xFFE53935), fontSize: 14)),
                      ),
                    ),
                  ],
                  if (onCancel != null) ...[
                    const SizedBox(height: 4),
                    SizedBox(
                      width: double.infinity,
                      child: TextButton(
                        onPressed: onCancel,
                        child: const Text(
                          'Cancel appointment',
                          style: TextStyle(
                              color: Color(0xFF929296), fontSize: 13),
                        ),
                      ),
                    ),
                  ],
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
