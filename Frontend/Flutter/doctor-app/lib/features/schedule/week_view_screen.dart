import 'package:cms_doctor_app/core/api/services/appointment_api_service.dart';
import 'package:cms_doctor_app/core/utils/date_format.dart';
import 'package:cms_doctor_app/features/patients/patient_record_screen.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/layout/app_shell.dart';
import '../../core/navigation/app_navigation.dart';
import 'visit_actions.dart';
import 'widgets/advanced_week_agenda.dart';
import 'widgets/schedule_chrome.dart';
import 'widgets/schedule_workspace.dart';

/// Week tab: next 6 days (tomorrow → +5), each day as an expandable visit list.
class WeekViewScreen extends StatefulWidget {
  const WeekViewScreen({super.key});

  @override
  State<WeekViewScreen> createState() => _WeekViewScreenState();
}

class _WeekViewScreenState extends State<WeekViewScreen> {
  final int _navIndex = 0;

  late DateTime _rangeStart;
  List<DateTime> _days = const [];
  List<DoctorAppointment> _appointments = [];
  Set<int> _expanded = {};
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _recomputeWindow();
    // Expand tomorrow by default so the first drop-down is open.
    if (_days.isNotEmpty) {
      _expanded = {AdvancedWeekAgenda.dayKey(_days.first)};
    }
    _load();
  }

  /// Six days starting tomorrow (not today).
  void _recomputeWindow() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    _rangeStart = today.add(const Duration(days: 1));
    _days = List.generate(6, (i) => _rangeStart.add(Duration(days: i)));
  }

  DateTime get _rangeEndExclusive =>
      _rangeStart.add(const Duration(days: 6));

  Map<int, List<DoctorAppointment>> get _appointmentsByDay {
    final map = <int, List<DoctorAppointment>>{
      for (final d in _days) AdvancedWeekAgenda.dayKey(d): <DoctorAppointment>[],
    };
    for (final a in _appointments) {
      final key = AdvancedWeekAgenda.dayKey(a.scheduledAt);
      map.putIfAbsent(key, () => <DoctorAppointment>[]).add(a);
    }
    for (final list in map.values) {
      list.sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));
    }
    return map;
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _recomputeWindow();
    });
    try {
      final list = await appointmentApi.getMySchedule(
        from: _rangeStart,
        to: _rangeEndExclusive,
      );
      if (!mounted) return;
      final filtered = list
          .where(
            (a) => _days.any((d) => isSameDay(a.scheduledAt, d)),
          )
          .toList()
        ..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));

      setState(() {
        _appointments = filtered;
        _loading = false;
        // Keep valid expanded keys; ensure tomorrow stays open if empty set.
        _expanded = _expanded
            .where((k) => _days.any((d) => AdvancedWeekAgenda.dayKey(d) == k))
            .toSet();
        if (_expanded.isEmpty && _days.isNotEmpty) {
          _expanded = {AdvancedWeekAgenda.dayKey(_days.first)};
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
        _appointments = [];
      });
    }
  }

  void _toggleDay(DateTime day) {
    final key = AdvancedWeekAgenda.dayKey(day);
    setState(() {
      if (_expanded.contains(key)) {
        _expanded = {..._expanded}..remove(key);
      } else {
        _expanded = {..._expanded, key};
      }
    });
  }

  void _openPatient(DoctorAppointment appointment) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => PatientRecordScreen(
          patientId: appointment.patientId,
          patientName: appointment.displayPatient,
          gender: appointment.patientGender,
          age: appointment.ageYears,
          avatarUrl: appointment.patientAvatarUrl,
          appointmentId: appointment.id,
          appointmentTime: appointment.timeLabel,
          appointmentDuration: appointment.durationLabel,
          appointmentStatus: appointment.uiStatus ?? appointment.status,
          appointmentReason: appointment.reason,
          appointmentNotes: appointment.notes,
          appointmentStoredNotes: appointment.storedNotes,
          isGuestPatient: appointment.isGuestPatient,
          guestPhone: appointment.patientPhone ?? appointment.guestPatientPhone,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final byDay = _appointmentsByDay;
    final total = _appointments.length;
    final busy = _days.where((d) {
      return (byDay[AdvancedWeekAgenda.dayKey(d)] ?? const []).isNotEmpty;
    }).length;
    final rangeLabel = _days.isEmpty
        ? ''
        : '${DateFormat.MMMd().format(_days.first)} – ${DateFormat.MMMd().format(_days.last)}';

    return Scaffold(
      backgroundColor: const Color(0xFFF2F2F2),
      body: ScheduleWorkspace(
        activeTab: 1,
        scrollEntirePage: true,
        boardCaption: total == 0
            ? 'Your next 6 days are clear.'
            : '$total visit${total == 1 ? '' : 's'} across the next 6 days.',
        onNotificationTap: () => openNotifications(context),
        onRefresh: _load,
        metrics: [
          ScheduleMetric(
            label: 'Total',
            value: '$total',
            progress: (total / 24).clamp(0.0, 1.0),
            icon: Icons.event_note_outlined,
          ),
          ScheduleMetric(
            label: 'Busy days',
            value: '$busy',
            progress: busy / 6,
            icon: Icons.local_fire_department_outlined,
            accent: const Color(0xFFE65C00),
          ),
          ScheduleMetric(
            label: 'Avg / day',
            value: total == 0 ? '0' : (total / 6).toStringAsFixed(1),
            progress: ((total / 6) / 6).clamp(0.0, 1.0),
            icon: Icons.trending_up,
            accent: const Color(0xFF2E7D32),
          ),
        ],
        child: AdvancedWeekAgenda(
          days: _days,
          appointmentsByDay: byDay,
          expandedKeys: _expanded,
          loading: _loading,
          error: _error,
          rangeLabel: rangeLabel,
          onToggleDay: _toggleDay,
          onRefresh: _load,
          onAppointmentTap: _openPatient,
          onAppointmentLongPress: (a) => VisitActions.showBoardActions(
            context,
            appointment: a,
            onDone: _load,
          ),
        ),
      ),
      bottomNavigationBar:
          buildBottomNav(_navIndex, (i) => switchMainTab(context, _navIndex, i)),
    );
  }
}
