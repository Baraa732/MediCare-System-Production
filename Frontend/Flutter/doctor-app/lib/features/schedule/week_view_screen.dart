import 'package:cms_doctor_app/core/api/services/appointment_api_service.dart';
import 'package:cms_doctor_app/core/utils/date_format.dart';
import 'package:cms_doctor_app/features/patients/patient_record_screen.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../../core/layout/app_shell.dart';
import '../../core/navigation/app_navigation.dart';
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
  late DateTime _selected;
  List<DoctorAppointment> _appointments = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _weekStart = DateTime(now.year, now.month, now.day)
        .subtract(Duration(days: now.weekday - 1));
    _selected = DateTime(now.year, now.month, now.day);
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // Load previous week + current week + next week.
      final from = _weekStart.subtract(const Duration(days: 7));
      final to = _weekStart.add(const Duration(days: 14));
      final list = await appointmentApi.getMySchedule(from: from, to: to);
      if (!mounted) return;
      setState(() {
        _appointments = list;
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

  List<DoctorAppointment> _forDay(DateTime day) {
    return _appointments
        .where((a) => isSameDay(a.scheduledAt, day))
        .toList()
      ..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));
  }

  void _shiftWeek(int delta) {
    setState(() {
      _weekStart = _weekStart.add(Duration(days: 7 * delta));
      // Keep selection inside the newly focused week when possible.
      final inFocus = _selected.isAfter(_weekStart.subtract(const Duration(days: 1))) &&
          _selected.isBefore(_weekStart.add(const Duration(days: 7)));
      if (!inFocus) {
        _selected = _weekStart;
      }
    });
    _load();
  }

  int get _busyDays => _focusWeekDays.where((d) => _forDay(d).isNotEmpty).length;

  /// Focus week (current).
  List<DateTime> get _focusWeekDays =>
      List.generate(7, (i) => _weekStart.add(Duration(days: i)));

  /// Previous + current + next week (21 days).
  List<DateTime> get _days => List.generate(
        21,
        (i) => _weekStart.subtract(const Duration(days: 7)).add(Duration(days: i)),
      );

  Map<int, int> get _counts {
    final map = <int, int>{};
    for (final a in _appointments) {
      final key = a.scheduledAt.year * 10000 +
          a.scheduledAt.month * 100 +
          a.scheduledAt.day;
      map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }

  @override
  Widget build(BuildContext context) {
    final rangeLabel =
        '${DateFormat.MMMd().format(_weekStart.subtract(const Duration(days: 7)))} – ${DateFormat.MMMd().format(_weekStart.add(const Duration(days: 13)))}';
    final total = _appointments.length;
    final busy = _busyDays;
    final selectedItems = _forDay(_selected);

    return Scaffold(
      backgroundColor: const Color(0xFFF2F2F2),
      body: ScheduleWorkspace(
        activeTab: 1,
        boardCaption: total == 0
            ? 'Weekly overview — quiet stretch ahead.'
            : '$total visits across last / this / next week.',
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
            value: total == 0 ? '0' : (total / 21).toStringAsFixed(1),
            progress: ((total / 21) / 5).clamp(0.0, 1.0),
            icon: Icons.trending_up,
            accent: const Color(0xFF2E7D32),
          ),
        ],
        slivers: [
          SliverToBoxAdapter(
            child: ExpandingPanel(
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0B74FA).withValues(alpha: 0.08),
                          blurRadius: 18,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            _navCircle(
                              Icons.chevron_left_rounded,
                              onTap: () => _shiftWeek(-1),
                            ),
                            Expanded(
                              child: Column(
                                children: [
                                  const Text(
                                    'Last · This · Next week',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF929296),
                                    ),
                                  ),
                                  Text(
                                    rangeLabel,
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFF1A1B1E),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            _navCircle(
                              Icons.chevron_right_rounded,
                              onTap: () => _shiftWeek(1),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        PremiumDateStrip(
                          days: _days,
                          selected: _selected,
                          counts: _counts,
                          onSelect: (d) {
                            HapticFeedback.selectionClick();
                            final focusEnd =
                                _weekStart.add(const Duration(days: 7));
                            final needsReload = d.isBefore(_weekStart) ||
                                !d.isBefore(focusEnd);
                            setState(() {
                              _selected = d;
                              if (needsReload) {
                                _weekStart = DateTime(d.year, d.month, d.day)
                                    .subtract(Duration(days: d.weekday - 1));
                              }
                            });
                            if (needsReload) _load();
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Text(
                        DateFormat('EEEE, MMM d').format(_selected),
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF1A1B1E),
                        ),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEEF4FF),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          '${selectedItems.length} visit${selectedItems.length == 1 ? '' : 's'}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0B74FA),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
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
                title: 'Could not load this week',
              ),
            )
          else if (selectedItems.isEmpty)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: ScheduleEmptyState(
                title: 'Clear day',
                subtitle: 'Pick another day from last, this, or next week.',
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, i) {
                    final a = selectedItems[i];
                    return AnimatedAppointmentTile(
                      index: i,
                      child: _weekTile(a),
                    );
                  },
                  childCount: selectedItems.length,
                ),
              ),
            ),
          SliverToBoxAdapter(
            child: ExpandingPanel(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'This week density',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF1A1B1E),
                    ),
                  ),
                  const SizedBox(height: 10),
                  ..._focusWeekDays.asMap().entries.map((e) {
                    final day = e.value;
                    final count = _forDay(day).length;
                    final max = _focusWeekDays
                        .map((d) => _forDay(d).length)
                        .fold<int>(1, (a, b) => a > b ? a : b);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 42,
                            child: Text(
                              DateFormat('E').format(day),
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: isSameDay(day, _selected)
                                    ? const Color(0xFF0B74FA)
                                    : const Color(0xFF929296),
                              ),
                            ),
                          ),
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: TweenAnimationBuilder<double>(
                                tween: Tween(begin: 0, end: count / max),
                                duration: Duration(milliseconds: 420 + e.key * 40),
                                curve: Curves.easeOutCubic,
                                builder: (_, v, __) => LinearProgressIndicator(
                                  value: v,
                                  minHeight: 10,
                                  backgroundColor: const Color(0xFFEEF0F3),
                                  color: isSameDay(day, _selected)
                                      ? const Color(0xFF0B74FA)
                                      : const Color(0xFF0B74FA)
                                          .withValues(alpha: 0.35),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '$count',
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF1A1B1E),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar:
          buildBottomNav(_navIndex, (i) => switchMainTab(context, _navIndex, i)),
    );
  }

  Widget _navCircle(IconData icon, {VoidCallback? onTap}) => Material(
        color: const Color(0xFF0B74FA),
        shape: const CircleBorder(),
        elevation: 2,
        shadowColor: const Color(0xFF0B74FA).withValues(alpha: 0.35),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(
            width: 40,
            height: 40,
            child: Icon(icon, color: Colors.white, size: 22),
          ),
        ),
      );

  Widget _weekTile(DoctorAppointment a) {
    final accent = a.status == 'REQUESTED'
        ? const Color(0xFFE65C00)
        : a.status == 'COMPLETED'
            ? const Color(0xFF2E7D32)
            : const Color(0xFF0B74FA);
    final end = a.scheduledAt.add(Duration(minutes: a.durationMinutes));
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => PatientRecordScreen(
                patientId: a.patientId,
                patientName: a.displayPatient,
                gender: a.patientGender,
                age: a.ageYears,
                appointmentId: a.id,
                appointmentTime: a.timeLabel,
                appointmentDuration: a.durationLabel,
                appointmentStatus: a.uiStatus ?? a.status,
                appointmentReason: a.reason,
                appointmentNotes: a.notes,
              ),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(Icons.medical_services_outlined, color: accent),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        a.displayPatient,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF1A1B1E),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${DateFormat.jm().format(a.scheduledAt)} – ${DateFormat.jm().format(end)}',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: accent,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    a.uiStatus ?? 'Pending',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                      color: accent,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
