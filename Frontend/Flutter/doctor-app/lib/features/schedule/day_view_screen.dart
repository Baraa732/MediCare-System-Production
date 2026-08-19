import 'package:cms_doctor_app/core/api/services/appointment_api_service.dart';
import 'package:cms_doctor_app/features/patients/patient_record_screen.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/layout/app_shell.dart';
import '../../core/navigation/app_navigation.dart';
import 'visit_actions.dart';
import 'widgets/schedule_chrome.dart';
import 'widgets/schedule_workspace.dart';

class DayViewScreen extends StatefulWidget {
  const DayViewScreen({super.key, this.showEmpty = false});
  final bool showEmpty;

  @override
  State<DayViewScreen> createState() => _DayViewScreenState();
}

class _DayViewScreenState extends State<DayViewScreen> {
  final int _navIndex = 0;
  late DateTime _today;
  List<DoctorAppointment> _appointments = [];
  List<Map<String, dynamic>> _clinicHours = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _today = DateTime(now.year, now.month, now.day);
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dayEnd = _today.add(const Duration(days: 1));
      final results = await Future.wait([
        appointmentApi.getMySchedule(from: _today, to: dayEnd),
        scheduleApi.getClinicHours().catchError((_) => <Map<String, dynamic>>[]),
      ]);
      if (!mounted) return;
      setState(() {
        _appointments = results[0] as List<DoctorAppointment>;
        _clinicHours = results[1] as List<Map<String, dynamic>>;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
        _appointments = [];
        _clinicHours = [];
      });
    }
  }

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

  int get _gridStartHour {
    final slot = _todayHours;
    if (slot == null || slot['isClosed'] == true) return 8;
    final openTime = slot['openTime']?.toString() ?? '09:00';
    return (_minutes(openTime) ~/ 60).clamp(0, 23);
  }

  int get _gridEndHour {
    final slot = _todayHours;
    if (slot == null || slot['isClosed'] == true) return 17;
    final closeTime = slot['closeTime']?.toString() ?? '17:00';
    return (_minutes(closeTime) / 60).ceil().clamp(1, 24);
  }

  List<DoctorAppointment> _forDayHour(DateTime day, int hour) {
    return _appointments.where((a) {
      final d = a.scheduledAt;
      return d.year == day.year &&
          d.month == day.month &&
          d.day == day.day &&
          d.hour == hour;
    }).toList()
      ..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));
  }

  bool _isClosed(DateTime day) {
    final slot = _hoursByDay[day.weekday % 7];
    if (slot == null) return false;
    return slot['isClosed'] == true;
  }

  Widget _buildDayTable(int hourStart, int hourEnd) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const timeAxisWidth = 62.0;
        final dayWidth = constraints.maxWidth - timeAxisWidth;
        final closed = _isClosed(_today);
        return Column(
          children: [
            for (int hour = hourStart; hour < hourEnd; hour++)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: timeAxisWidth,
                    child: Container(
                      padding: const EdgeInsets.only(top: 12, right: 8),
                      child: Text(
                        DateFormat.j().format(DateTime(2020, 1, 1, hour)),
                        textAlign: TextAlign.right,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF929296),
                        ),
                      ),
                    ),
                  ),
                  Container(
                    width: dayWidth,
                    constraints: const BoxConstraints(minHeight: 74),
                    margin: const EdgeInsets.symmetric(horizontal: 1, vertical: 2),
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: closed
                          ? const Color(0xFFF2F2F2)
                          : const Color(0xFFFBFCFF),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFE4E6EB)),
                    ),
                    child: closed
                        ? const Text(
                            'Off',
                            style: TextStyle(
                              color: Color(0xFF929296),
                              fontSize: 12,
                            ),
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              for (final a in _forDayHour(_today, hour))
                                _WeekAppointmentChip(
                                  appointment: a,
                                  onRefresh: _load,
                                ),
                            ],
                          ),
                  ),
                ],
              ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final total = _appointments.length;
    final doneProgress = total == 0 ? 0.0 : _completedCount / total;
    final pendingProgress = total == 0 ? 0.0 : _pendingCount / total;
    final arrivedProgress = total == 0 ? 0.0 : _arrivedCount / total;
    final hourStart = _gridStartHour;
    final hourEnd = _gridEndHour;
    final dateLabel = DateFormat('EEEE, MMM d').format(_today);

    return Scaffold(
      backgroundColor: const Color(0xFFF2F2F2),
      body: ScheduleWorkspace(
        activeTab: 0,
        boardCaption: total == 0
            ? 'Today schedule is ready.'
            : '$total visits today.',
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
        slivers: [
          SliverToBoxAdapter(
            child: ExpandingPanel(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                ),
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Daily Schedule',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF1A1B1E),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 8,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEEF4FF),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                    Icons.calendar_month_rounded,
                                    size: 16,
                                    color: Color(0xFF0B74FA),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    dateLabel,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12.5,
                                      color: Color(0xFF1A1B1E),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  const Icon(
                                    Icons.keyboard_arrow_down_rounded,
                                    size: 16,
                                    color: Color(0xFF929296),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEEF4FF),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: const Color(0xFF0B74FA),
                              width: 1.0,
                            ),
                          ),
                          child: const Text(
                            'Today',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 12,
                              color: Color(0xFF0B74FA),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    _buildDayTable(hourStart, hourEnd),
                  ],
                ),
              ),
            ),
          ),
          if (_loading)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: CircularProgressIndicator(color: Color(0xFF0B74FA)),
              ),
            )
          else if (_error != null)
            SliverFillRemaining(
              hasScrollBody: false,
              child: ScheduleEmptyState(
                error: _error,
                title: 'Could not load daily scheduler',
              ),
            )
          else
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Text(
                  'Clinic hours are read-only from clinic admin configuration.',
                  style: TextStyle(
                    color: Colors.blueGrey.shade600,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar:
          buildBottomNav(_navIndex, (i) => switchMainTab(context, _navIndex, i)),
    );
  }

}

class _WeekAppointmentChip extends StatelessWidget {
  const _WeekAppointmentChip({
    required this.appointment,
    required this.onRefresh,
  });

  final DoctorAppointment appointment;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final accent = appointment.status == 'COMPLETED'
        ? const Color(0xFF2E7D32)
        : appointment.status == 'NO_SHOW'
            ? const Color(0xFFE53935)
            : appointment.status == 'CANCELLED'
                ? const Color(0xFF929296)
                : appointment.status == 'REQUESTED'
                    ? const Color(0xFFE65C00)
                    : const Color(0xFF0B74FA);
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onLongPress: () => showModalBottomSheet<void>(
        context: context,
        builder: (ctx) => SafeArea(
          child: Wrap(
            children: [
              ListTile(
                leading: const Icon(Icons.check_circle_outline),
                title: const Text('Complete'),
                onTap: () {
                  Navigator.pop(ctx);
                  VisitActions.showCompleteSheet(
                    context,
                    patient: appointment.displayPatient,
                    time: appointment.timeLabel,
                    appointmentId: appointment.id,
                    patientId: appointment.patientId,
                    onDone: onRefresh,
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.login_rounded),
                title: const Text('Mark arrived'),
                onTap: () {
                  Navigator.pop(ctx);
                  VisitActions.markArrived(
                    context,
                    appointmentId: appointment.id,
                    onDone: onRefresh,
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.event_busy, color: Color(0xFFE53935)),
                title: const Text('No show'),
                onTap: () {
                  Navigator.pop(ctx);
                  VisitActions.markNoShow(
                    context,
                    appointmentId: appointment.id,
                    onDone: onRefresh,
                  );
                },
              ),
            ],
          ),
        ),
      ),
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => PatientRecordScreen(
            patientId: appointment.patientId,
            patientName: appointment.displayPatient,
            gender: appointment.patientGender,
            age: appointment.ageYears,
            appointmentId: appointment.id,
            appointmentTime: appointment.timeLabel,
            appointmentDuration: appointment.durationLabel,
            appointmentStatus: appointment.uiStatus ?? appointment.status,
            appointmentReason: appointment.reason,
            appointmentNotes: appointment.notes,
          ),
        ),
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 4),
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: accent.withValues(alpha: 0.35)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${DateFormat.jm().format(appointment.scheduledAt)} • ${appointment.durationMinutes}m',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: accent,
                fontSize: 11.5,
              ),
            ),
            Text(
              appointment.displayPatient,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1A1B1E),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
