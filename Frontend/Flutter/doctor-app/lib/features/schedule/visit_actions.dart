import 'package:cms_doctor_app/core/api/services/appointment_api_service.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';

import '../../core/navigation/app_navigation.dart';
import 'complete_visit_sheet.dart';

class VisitActions {
  VisitActions._();

  static bool isOpen(String status) =>
      status != 'COMPLETED' && status != 'CANCELLED' && status != 'NO_SHOW';

  static Future<void> complete(
    BuildContext context, {
    required String appointmentId,
    required String patientId,
    required String notes,
    VoidCallback? onDone,
  }) async {
    try {
      if (notes.trim().isNotEmpty) {
        await appointmentApi.updateNotes(appointmentId, notes.trim());
        // EMR only for registered MediCare patients — never for manual guests.
        if (patientId.trim().isNotEmpty) {
          try {
            await emrApi.addClinicalNote(
              patientId,
              content: notes.trim(),
              type: 'Visit note',
            );
          } catch (_) {}
        }
      }
      await appointmentApi.updateStatus(appointmentId, 'COMPLETED');
      if (context.mounted) showSnack(context, 'Visit marked completed');
      onDone?.call();
    } catch (e) {
      if (context.mounted) showSnack(context, e.toString());
    }
  }

  static Future<void> markArrived(
    BuildContext context, {
    required String appointmentId,
    VoidCallback? onDone,
  }) async {
    try {
      await appointmentApi.updateStatus(appointmentId, 'CONFIRMED');
      if (context.mounted) showSnack(context, 'Patient marked arrived');
      onDone?.call();
    } catch (e) {
      if (context.mounted) showSnack(context, e.toString());
    }
  }

  static Future<void> markNoShow(
    BuildContext context, {
    required String appointmentId,
    VoidCallback? onDone,
  }) async {
    try {
      await appointmentApi.updateStatus(appointmentId, 'NO_SHOW');
      if (context.mounted) showSnack(context, 'Marked as no-show');
      onDone?.call();
    } catch (e) {
      if (context.mounted) showSnack(context, e.toString());
    }
  }

  static Future<void> cancel(
    BuildContext context, {
    required String appointmentId,
    VoidCallback? onDone,
  }) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel visit?'),
        content: const Text(
          'This appointment will be cancelled. The patient can book another slot.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cancel visit',
                style: TextStyle(color: Color(0xFFE53935))),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await appointmentApi.updateStatus(appointmentId, 'CANCELLED');
      if (context.mounted) showSnack(context, 'Appointment cancelled');
      onDone?.call();
    } catch (e) {
      if (context.mounted) showSnack(context, e.toString());
    }
  }

  static Future<void> reschedule(
    BuildContext context, {
    required String appointmentId,
    DateTime? initial,
    VoidCallback? onDone,
  }) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: initial ?? DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked == null || !context.mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: initial != null
          ? TimeOfDay.fromDateTime(initial)
          : TimeOfDay.now(),
    );
    if (time == null || !context.mounted) return;
    final scheduled = DateTime(
      picked.year,
      picked.month,
      picked.day,
      time.hour,
      time.minute,
    );
    try {
      await appointmentApi.reschedule(appointmentId, scheduled);
      if (context.mounted) showSnack(context, 'Appointment rescheduled');
      onDone?.call();
    } catch (e) {
      if (context.mounted) showSnack(context, e.toString());
    }
  }

  static void showCompleteSheet(
    BuildContext context, {
    required String patient,
    required String time,
    required String appointmentId,
    required String patientId,
    VoidCallback? onDone,
  }) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => CompleteVisitSheet(
        appointmentTime: time,
        patient: patient,
        onCompleted: (notes) => complete(
          context,
          appointmentId: appointmentId,
          patientId: patientId,
          notes: notes,
          onDone: onDone,
        ),
      ),
    );
  }

  static void showBoardActions(
    BuildContext context, {
    required DoctorAppointment appointment,
    required VoidCallback onDone,
  }) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFDBDBDC),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              ListTile(
                leading: const Icon(Icons.check_circle_outline),
                title: const Text('Complete'),
                onTap: () {
                  Navigator.pop(ctx);
                  showCompleteSheet(
                    context,
                    patient: appointment.displayPatient,
                    time: appointment.timeLabel,
                    appointmentId: appointment.id,
                    patientId: appointment.patientId,
                    onDone: onDone,
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.login_rounded),
                title: const Text('Mark arrived'),
                onTap: () {
                  Navigator.pop(ctx);
                  markArrived(
                    context,
                    appointmentId: appointment.id,
                    onDone: onDone,
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.event_busy, color: Color(0xFFE53935)),
                title: const Text('No show'),
                onTap: () {
                  Navigator.pop(ctx);
                  markNoShow(
                    context,
                    appointmentId: appointment.id,
                    onDone: onDone,
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  static void bindFromDoctor(
    BuildContext context,
    DoctorAppointment apt,
    VoidCallback onDone, {
    required void Function({
      required VoidCallback onComplete,
      required VoidCallback onReschedule,
      VoidCallback? onMarkArrived,
      VoidCallback? onNoShow,
      VoidCallback? onCancel,
    }) use,
  }) {
    use(
      onComplete: () => showCompleteSheet(
        context,
        patient: apt.displayPatient,
        time: apt.timeLabel,
        appointmentId: apt.id,
        patientId: apt.patientId,
        onDone: onDone,
      ),
      onReschedule: () => reschedule(
        context,
        appointmentId: apt.id,
        initial: apt.scheduledAt,
        onDone: onDone,
      ),
      onMarkArrived: apt.status == 'REQUESTED'
          ? () => markArrived(
                context,
                appointmentId: apt.id,
                onDone: onDone,
              )
          : null,
      onNoShow: () => markNoShow(
        context,
        appointmentId: apt.id,
        onDone: onDone,
      ),
      onCancel: () => cancel(
        context,
        appointmentId: apt.id,
        onDone: onDone,
      ),
    );
  }
}
