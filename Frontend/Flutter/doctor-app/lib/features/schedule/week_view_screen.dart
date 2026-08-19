import 'package:cms_doctor_app/core/api/services/appointment_api_service.dart';
import 'package:cms_doctor_app/core/utils/date_format.dart';
import 'package:cms_doctor_app/features/patients/patient_record_screen.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/layout/app_shell.dart';
import '../../core/navigation/app_navigation.dart';
import 'visit_actions.dart';
import 'widgets/schedule_chrome.dart';
import 'widgets/schedule_workspace.dart';

class WeekViewScreen extends StatefulWidget {
  const WeekViewScreen({super.key});

  @override
  State<WeekViewScreen> createState() => _WeekViewScreenState();
}

class _WeekViewScreenState extends State<WeekViewScreen> {
  final int _navIndex = 0;
  late DateTime _weekStart;
  List<DoctorAppointment> _appointments = [];
  List<Map<String, dynamic>> _clinicHours = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _weekStart = DateTime(now.year, now.month, now.day);
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final weekEnd = _weekStart.add(const Duration(days: 7));
      final results = await Future.wait([
        appointmentApi.getMySchedule(from: _weekStart, to: weekEnd),
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
      });
    }
  }

  void _shiftWeek(int delta) {
    setState(() {
      _weekStart = _weekStart.add(Duration(days: 7 * delta));
    });
    _load();
  }

  List<DateTime> get _days =>
      List.generate(7, (i) => _weekStart.add(Duration(days: i)));

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

  int get _gridStartHour {
    var minMins = 24 * 60;
    for (final h in _hoursByDay.values) {
      if (h['isClosed'] == true) continue;
      minMins = _minutes(h['openTime']?.toString() ?? '09:00',
              fallback: minMins) <
          minMins
          ? _minutes(h['openTime']?.toString() ?? '09:00')
          : minMins;
    }
    if (minMins == 24 * 60) return 8;
    return (minMins ~/ 60).clamp(0, 23);
  }

  int get _gridEndHour {
    var maxMins = 0;
    for (final h in _hoursByDay.values) {
      if (h['isClosed'] == true) continue;
      maxMins = _minutes(h['closeTime']?.toString() ?? '17:00',
              fallback: maxMins) >
          maxMins
          ? _minutes(h['closeTime']?.toString() ?? '17:00')
          : maxMins;
    }
    if (maxMins == 0) return 17;
    return (maxMins / 60).ceil().clamp(1, 24);
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

  Widget _buildWeekTable(int hourStart, int hourEnd) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Column(
        children: [
          Row(
            children: [
              const SizedBox(width: 62),
              for (final d in _days)
                Container(
                  width: 150,
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  alignment: Alignment.center,
                  child: Text(
                    '${DateFormat.E().format(d)} ${d.day}',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: isSameDay(d, DateTime.now())
                          ? const Color(0xFF0B74FA)
                          : const Color(0xFF1A1B1E),
                    ),
                  ),
                ),
            ],
          ),
          for (int hour = hourStart; hour < hourEnd; hour++)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 62,
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
                for (final d in _days)
                  Builder(
                    builder: (_) {
                      final closed = _isClosed(d);
                      final items = _forDayHour(d, hour);
                      return Container(
                        width: 150,
                        constraints: const BoxConstraints(minHeight: 74),
                        margin: const EdgeInsets.all(2),
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
                                  for (final a in items)
                                    _WeekAppointmentChip(
                                      appointment: a,
                                      onRefresh: _load,
                                    ),
                                ],
                              ),
                      );
                    },
                  ),
              ],
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final rangeLabel =
        '${DateFormat.MMMd().format(_weekStart)} - ${DateFormat.MMMd().format(_weekStart.add(const Duration(days: 6)))}';
    final total = _appointments.length;
    final busy = _days.where((d) {
      return _appointments.any((a) =>
          a.scheduledAt.year == d.year &&
          a.scheduledAt.month == d.month &&
          a.scheduledAt.day == d.day);
    }).length;
    final hourStart = _gridStartHour;
    final hourEnd = _gridEndHour;

    return Scaffold(
      backgroundColor: const Color(0xFFF2F2F2),
      body: ScheduleWorkspace(
        activeTab: 1,
        boardCaption: total == 0
            ? 'Weekly board is ready.'
            : '$total visits in this 7-day scheduler.',
        onNotificationTap: () => openNotifications(context),
        onRefresh: _load,
        metrics: [
          ScheduleMetric(
            label: 'Total',
            value: '$total',
            progress: (total / 40).clamp(0.0, 1.0),
            icon: Icons.event_note_outlined,
          ),
          ScheduleMetric(
            label: 'Busy days',
            value: '$busy',
            progress: busy / 7,
            icon: Icons.local_fire_department_outlined,
            accent: const Color(0xFFE65C00),
          ),
          ScheduleMetric(
            label: 'Avg / day',
            value: total == 0 ? '0' : (total / 7).toStringAsFixed(1),
            progress: ((total / 7) / 8).clamp(0.0, 1.0),
            icon: Icons.trending_up,
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
                        IconButton(
                          onPressed: () => _shiftWeek(-1),
                          icon: const Icon(Icons.chevron_left),
                        ),
                        Expanded(
                          child: Text(
                            'Week Scheduler\n$rangeLabel',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1A1B1E),
                            ),
                          ),
                        ),
                        IconButton(
                          onPressed: () => _shiftWeek(1),
                          icon: const Icon(Icons.chevron_right),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    _buildWeekTable(hourStart, hourEnd),
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
                title: 'Could not load weekly scheduler',
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
