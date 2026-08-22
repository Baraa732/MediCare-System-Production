import 'package:cms_doctor_app/core/api/services/appointment_api_service.dart';
import 'package:cms_doctor_app/core/utils/date_format.dart';
import 'package:cms_doctor_app/features/patients/patient_record_screen.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:syncfusion_flutter_calendar/calendar.dart';

import '../../core/layout/app_shell.dart';
import '../../core/navigation/app_navigation.dart';
import 'visit_actions.dart';
import 'widgets/advanced_day_timeline.dart';
import 'widgets/schedule_chrome.dart';
import 'widgets/schedule_workspace.dart';

/// Day tab: locked to the clinic's current calendar day.
/// Vertical time-grid only — no scrollable week strip / day paging.
class DayViewScreen extends StatefulWidget {
  const DayViewScreen({super.key, this.showEmpty = false});
  final bool showEmpty;

  @override
  State<DayViewScreen> createState() => _DayViewScreenState();
}

class _DayViewScreenState extends State<DayViewScreen> {
  final int _navIndex = 0;
  final CalendarController _calendarController = CalendarController();

  late DateTime _today;
  List<DoctorAppointment> _appointments = [];
  List<Map<String, dynamic>> _clinicHours = [];
  DoctorCalendarDataSource _dataSource = DoctorCalendarDataSource([]);
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _today = _startOfToday();
    _calendarController.view = CalendarView.day;
    _calendarController.displayDate = _today;
    _load();
  }

  @override
  void dispose() {
    _calendarController.dispose();
    super.dispose();
  }

  DateTime _startOfToday() {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day);
  }

  DateTime get _dayEnd => _today.add(const Duration(days: 1));

  int get _completedCount =>
      _appointments.where((a) => a.status == 'COMPLETED').length;
  int get _pendingCount =>
      _appointments.where((a) => a.status == 'REQUESTED').length;
  int get _arrivedCount =>
      _appointments.where((a) => a.status == 'CONFIRMED').length;

  Map<int, Map<String, dynamic>> get _hoursByDay {
    final map = <int, Map<String, dynamic>>{};
    for (final h in _clinicHours) {
      final day = int.tryParse(h['dayOfWeek']?.toString() ?? '');
      if (day != null) map[day] = h;
    }
    return map;
  }

  int _minutes(String hhmm, {int fallback = 8 * 60}) {
    final parts = hhmm.split(':');
    if (parts.length != 2) return fallback;
    final h = int.tryParse(parts[0]) ?? (fallback ~/ 60);
    final m = int.tryParse(parts[1]) ?? 0;
    return h * 60 + m;
  }

  Map<String, dynamic>? get _todayHours => _hoursByDay[_today.weekday % 7];

  bool get _isClosed {
    final slot = _todayHours;
    if (slot == null) return false;
    return slot['isClosed'] == true;
  }

  double get _gridStartHour {
    final slot = _todayHours;
    if (slot == null || slot['isClosed'] == true) return 8;
    final open = _minutes(slot['openTime']?.toString() ?? '09:00');
    return ((open ~/ 60) - 1).clamp(0, 23).toDouble();
  }

  double get _gridEndHour {
    final slot = _todayHours;
    if (slot == null || slot['isClosed'] == true) return 17;
    final close = _minutes(
      slot['closeTime']?.toString() ?? '17:00',
      fallback: 17 * 60,
    );
    return (close / 60).ceil().clamp(1, 24).toDouble();
  }

  String get _hoursLabel {
    final slot = _todayHours;
    if (slot == null) return 'Clinic hours unset';
    if (slot['isClosed'] == true) return 'Clinic closed';
    final open = _minutes(slot['openTime']?.toString() ?? '09:00');
    final close = _minutes(
      slot['closeTime']?.toString() ?? '17:00',
      fallback: 17 * 60,
    );
    return '${_hhmm(open)} – ${_hhmm(close)}';
  }

  String _hhmm(int mins) {
    final h = (mins ~/ 60).clamp(0, 23);
    final m = mins % 60;
    return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}';
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _today = _startOfToday();
    });
    try {
      final results = await Future.wait([
        appointmentApi.getMySchedule(from: _today, to: _dayEnd),
        scheduleApi.getClinicHours().catchError((_) => <Map<String, dynamic>>[]),
      ]);
      if (!mounted) return;
      final list = (results[0] as List<DoctorAppointment>)
          .where((a) => isSameDay(a.scheduledAt, _today))
          .toList()
        ..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));

      setState(() {
        _appointments = list;
        _clinicHours = results[1] as List<Map<String, dynamic>>;
        _dataSource = DoctorCalendarDataSource(
          list.map(toCalendarAppointment).toList(),
        );
        _loading = false;
        _calendarController.displayDate = _today;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
        _appointments = [];
        _clinicHours = [];
        _dataSource = DoctorCalendarDataSource([]);
      });
    }
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
          isGuestPatient: appointment.isGuestPatient,
          guestPhone: appointment.patientPhone ?? appointment.guestPatientPhone,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final total = _appointments.length;
    final doneProgress = total == 0 ? 0.0 : _completedCount / total;
    final pendingProgress = total == 0 ? 0.0 : _pendingCount / total;
    final arrivedProgress = total == 0 ? 0.0 : _arrivedCount / total;

    return Scaffold(
      backgroundColor: const Color(0xFFF2F2F2),
      body: ScheduleWorkspace(
        activeTab: 0,
        scrollEntirePage: true,
        boardCaption: total == 0
            ? 'Your schedule for today is clear.'
            : "$total visit${total == 1 ? '' : 's'} on today's board.",
        onNotificationTap: () => openNotifications(context),
        onRefresh: _load,
        metrics: [
          ScheduleMetric(
            label: 'Pending',
            value: '$_pendingCount',
            progress: pendingProgress,
            icon: Icons.hourglass_top_rounded,
            accent: const Color(0xFFE65C00),
          ),
          ScheduleMetric(
            label: 'Arrived',
            value: '$_arrivedCount',
            progress: arrivedProgress,
            icon: Icons.login_rounded,
          ),
          ScheduleMetric(
            label: 'Done',
            value: '$_completedCount',
            progress: doneProgress,
            icon: Icons.verified_outlined,
            accent: const Color(0xFF2E7D32),
          ),
        ],
        child: AdvancedDayTimeline(
          day: _today,
          appointments: _appointments,
          hoursLabel: _hoursLabel,
          closed: _isClosed,
          loading: _loading,
          error: _error,
          controller: _calendarController,
          dataSource: _dataSource,
          specialRegions: clinicTimeRegions(
            weekDays: [_today],
            hoursByDay: _hoursByDay,
            startHour: _gridStartHour,
            endHour: _gridEndHour,
            parseMinutes: _minutes,
          ),
          startHour: _gridStartHour,
          endHour: _gridEndHour,
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
