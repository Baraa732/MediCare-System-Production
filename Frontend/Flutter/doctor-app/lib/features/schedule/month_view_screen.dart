import 'package:cms_doctor_app/core/api/services/appointment_api_service.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/layout/app_shell.dart';
import '../../core/navigation/app_navigation.dart';
import 'widgets/schedule_chrome.dart';
import 'widgets/schedule_workspace.dart';

class MonthViewScreen extends StatefulWidget {
  const MonthViewScreen({super.key});

  @override
  State<MonthViewScreen> createState() => _MonthViewScreenState();
}

class _MonthViewScreenState extends State<MonthViewScreen> {
  final int _navIndex = 0;
  late DateTime _month;
  late DateTime _selected;
  List<DoctorAppointment> _appointments = [];
  List<Map<String, dynamic>> _availability = [];
  List<Map<String, dynamic>> _hours = [];
  List<Map<String, dynamic>> _blocks = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month);
    _selected = DateTime(now.year, now.month, now.day);
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final from = _month;
      final to = DateTime(_month.year, _month.month + 1);
      final results = await Future.wait([
        appointmentApi.getMySchedule(from: from, to: to),
        scheduleApi.getMyAvailability().catchError((_) => <Map<String, dynamic>>[]),
        scheduleApi.getClinicHours().catchError((_) => <Map<String, dynamic>>[]),
        scheduleApi.getMyBlockedTimes(),
      ]);
      if (!mounted) return;
      setState(() {
        _appointments = results[0] as List<DoctorAppointment>;
        _availability = results[1] as List<Map<String, dynamic>>;
        _hours = results[2] as List<Map<String, dynamic>>;
        _blocks = results[3] as List<Map<String, dynamic>>;
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

  Set<int> get _daysWithAppointments {
    return _appointments
        .where((a) =>
            a.scheduledAt.year == _month.year &&
            a.scheduledAt.month == _month.month)
        .map((a) => a.scheduledAt.day)
        .toSet();
  }

  List<DoctorAppointment> get _selectedDayAppointments {
    return _appointments
        .where(
          (a) =>
              a.scheduledAt.year == _selected.year &&
              a.scheduledAt.month == _selected.month &&
              a.scheduledAt.day == _selected.day,
        )
        .toList();
  }

  Future<void> _onMonthChanged(DateTime month) async {
    setState(() => _month = DateTime(month.year, month.month));
    await _load();
  }

  int _parseMinutes(String? hhmm, {int fallback = 0}) {
    if (hhmm == null) return fallback;
    final parts = hhmm.split(':');
    if (parts.length != 2) return fallback;
    final h = int.tryParse(parts[0]) ?? 0;
    final m = int.tryParse(parts[1]) ?? 0;
    return h * 60 + m;
  }

  int _weekdayIndex(DateTime day) => day.weekday % 7; // sun=0

  int _capacityFor(DateTime day) {
    final idx = _weekdayIndex(day);
    final clinicDay = _hours.cast<Map<String, dynamic>?>().firstWhere(
          (h) => int.tryParse(h?['dayOfWeek']?.toString() ?? '') == idx,
          orElse: () => null,
        );
    final clinicClosed = clinicDay?['isClosed'] == true;
    if (clinicClosed) return 0;

    final availability = _availability
        .where((a) {
          final wd = int.tryParse(
              a['dayOfWeek']?.toString() ?? a['weekday']?.toString() ?? '');
          return wd == day.weekday || wd == idx;
        })
        .toList();

    int capacity;
    if (availability.isNotEmpty) {
      capacity = availability.fold<int>(0, (sum, a) {
        final start = _parseMinutes(
            a['startTime']?.toString() ?? a['startsAt']?.toString(),
            fallback: 9 * 60);
        final end = _parseMinutes(
            a['endTime']?.toString() ?? a['endsAt']?.toString(),
            fallback: 17 * 60);
        return sum + (end - start).clamp(0, 24 * 60);
      });
    } else {
      final open = _parseMinutes(clinicDay?['openTime']?.toString(),
          fallback: 9 * 60);
      final close = _parseMinutes(clinicDay?['closeTime']?.toString(),
          fallback: 17 * 60);
      capacity = (close - open).clamp(0, 24 * 60);
    }

    for (final b in _blocks) {
      final start = DateTime.tryParse(b['startsAt']?.toString() ?? '');
      final end = DateTime.tryParse(b['endsAt']?.toString() ?? '');
      if (start == null || end == null) continue;
      final dayStart = DateTime(day.year, day.month, day.day);
      final dayEnd = dayStart.add(const Duration(days: 1));
      if (start.isAfter(dayEnd) || end.isBefore(dayStart)) continue;
      final overlapStart = start.isAfter(dayStart) ? start : dayStart;
      final overlapEnd = end.isBefore(dayEnd) ? end : dayEnd;
      final mins = overlapEnd.difference(overlapStart).inMinutes;
      capacity -= mins;
    }
    return capacity.clamp(0, 24 * 60);
  }

  int _bookedMinutesFor(DateTime day) {
    return _appointments
        .where((a) =>
            a.scheduledAt.year == day.year &&
            a.scheduledAt.month == day.month &&
            a.scheduledAt.day == day.day &&
            a.status != 'CANCELLED')
        .fold<int>(0, (sum, a) => sum + a.durationMinutes);
  }

  _MonthDayStatus _statusFor(DateTime day) {
    final cap = _capacityFor(day);
    final booked = _bookedMinutesFor(day);
    if (cap <= 0) return _MonthDayStatus.off;
    if (booked == 0) return _MonthDayStatus.clean;
    if (booked >= cap) return _MonthDayStatus.full;
    return _MonthDayStatus.hasMore;
  }

  @override
  Widget build(BuildContext context) {
    final dayItems = _selectedDayAppointments;
    final total = _appointments.length;
    final activeDays = _daysWithAppointments.length;

    return Scaffold(
      backgroundColor: const Color(0xFFF2F2F2),
      body: ScheduleWorkspace(
        activeTab: 2,
        boardCaption: total == 0
            ? 'Your month map is ready — no visits yet.'
            : '$total visits across $activeDays active days.',
        onNotificationTap: () => openNotifications(context),
        onRefresh: _load,
        metrics: [
          ScheduleMetric(
            label: 'Month',
            value: '$total',
            progress: (total / 40).clamp(0.0, 1.0),
            icon: Icons.calendar_month_outlined,
          ),
          ScheduleMetric(
            label: 'Active',
            value: '$activeDays',
            progress: (activeDays / 31).clamp(0.0, 1.0),
            icon: Icons.brightness_1_outlined,
            accent: const Color(0xFFE65C00),
          ),
          ScheduleMetric(
            label: 'Selected',
            value: '${dayItems.length}',
            progress: (dayItems.length / 8).clamp(0.0, 1.0),
            icon: Icons.today_outlined,
            accent: const Color(0xFF2E7D32),
          ),
        ],
        slivers: [
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
                title: 'Could not load month scheduler',
                error: _error,
              ),
            )
          else ...[
          SliverToBoxAdapter(
            child: ExpandingPanel(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                ),
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: [
                    Row(
                      children: [
                        IconButton(
                          onPressed: () => _onMonthChanged(
                            DateTime(_month.year, _month.month - 1),
                          ),
                          icon: const Icon(Icons.chevron_left),
                        ),
                        Expanded(
                          child: Text(
                            DateFormat.yMMMM().format(_month),
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 16,
                            ),
                          ),
                        ),
                        IconButton(
                          onPressed: () => _onMonthChanged(
                            DateTime(_month.year, _month.month + 1),
                          ),
                          icon: const Icon(Icons.chevron_right),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    _MonthGrid(
                      month: _month,
                      selected: _selected,
                      onSelect: (d) => setState(() => _selected = d),
                      statusFor: _statusFor,
                    ),
                    const SizedBox(height: 10),
                    const Wrap(
                      spacing: 12,
                      runSpacing: 6,
                      children: [
                        _LegendDot(color: Color(0xFFE8F5E9), label: 'Clean day'),
                        _LegendDot(color: Color(0xFFE3F2FD), label: 'Has appointments'),
                        _LegendDot(color: Color(0xFFFFF3E0), label: 'Off / unavailable'),
                        _LegendDot(color: Color(0xFFFFEBEE), label: 'Fully booked'),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: ExpandingPanel(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      DateFormat('EEE, MMM d').format(_selected),
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 8),
                    if (dayItems.isEmpty)
                      const Text(
                        'No appointments for this day.',
                        style: TextStyle(color: Color(0xFF929296)),
                      )
                    else
                      ...dayItems.map(
                        (a) => Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Text(
                            '${DateFormat.jm().format(a.scheduledAt)} • ${a.displayPatient} • ${a.uiStatus ?? a.status}',
                            style: const TextStyle(
                              color: Color(0xFF1A1B1E),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          ],
        ],
      ),
      bottomNavigationBar:
          buildBottomNav(_navIndex, (i) => switchMainTab(context, _navIndex, i)),
    );
  }
}

enum _MonthDayStatus { clean, hasMore, off, full }

class _MonthGrid extends StatelessWidget {
  const _MonthGrid({
    required this.month,
    required this.selected,
    required this.onSelect,
    required this.statusFor,
  });

  final DateTime month;
  final DateTime selected;
  final ValueChanged<DateTime> onSelect;
  final _MonthDayStatus Function(DateTime day) statusFor;

  @override
  Widget build(BuildContext context) {
    final firstWeekday = DateTime(month.year, month.month, 1).weekday % 7;
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final cells = <int?>[
      ...List.filled(firstWeekday, null),
      ...List.generate(daysInMonth, (i) => i + 1),
    ];
    while (cells.length % 7 != 0) {
      cells.add(null);
    }
    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return Column(
      children: [
        Row(
          children: labels
              .map((d) => Expanded(
                    child: Center(
                      child: Text(
                        d,
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF929296),
                        ),
                      ),
                    ),
                  ))
              .toList(),
        ),
        const SizedBox(height: 6),
        ...List.generate(cells.length ~/ 7, (row) {
          final slice = cells.sublist(row * 7, row * 7 + 7);
          return Row(
            children: slice.map((n) {
              if (n == null) {
                return const Expanded(child: SizedBox(height: 44));
              }
              final d = DateTime(month.year, month.month, n);
              final status = statusFor(d);
              final selectedDay = d.year == selected.year &&
                  d.month == selected.month &&
                  d.day == selected.day;
              final bg = switch (status) {
                _MonthDayStatus.clean => const Color(0xFFE8F5E9),
                _MonthDayStatus.hasMore => const Color(0xFFE3F2FD),
                _MonthDayStatus.off => const Color(0xFFFFF3E0),
                _MonthDayStatus.full => const Color(0xFFFFEBEE),
              };
              return Expanded(
                child: GestureDetector(
                  onTap: () => onSelect(d),
                  child: Container(
                    height: 44,
                    margin: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: selectedDay ? const Color(0xFF0B74FA) : bg,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      '$n',
                      style: TextStyle(
                        color: selectedDay ? Colors.white : const Color(0xFF1A1B1E),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          );
        }),
      ],
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFFDBDBDC)),
            ),
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: Color(0xFF929296)),
          ),
        ],
      );
}
