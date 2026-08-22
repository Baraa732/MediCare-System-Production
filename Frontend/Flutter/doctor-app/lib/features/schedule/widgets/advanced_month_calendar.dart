import 'dart:math' as math;

import 'package:cms_doctor_app/core/api/services/appointment_api_service.dart';
import 'package:cms_doctor_app/core/utils/date_format.dart';
import 'package:cms_doctor_app/features/schedule/models/appointment.dart';
import 'package:cms_doctor_app/features/schedule/visit_actions.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'schedule_chrome.dart';
import 'schedule_workspace.dart';

/// Premium animated month planner as CustomScrollView slivers.
class AdvancedMonthCalendar {
  AdvancedMonthCalendar._();

  static List<Widget> slivers({
    required DateTime month,
    required DateTime selected,
    required List<DoctorAppointment> appointments,
    required bool loading,
    required String? error,
    required ValueChanged<DateTime> onMonthChanged,
    required ValueChanged<DateTime> onSelectedChanged,
    VoidCallback? onReload,
  }) {
    return [
      SliverToBoxAdapter(
        child: ExpandingPanel(
          child: _MonthPlannerCard(
            month: month,
            selected: selected,
            appointments: appointments,
            onMonthChanged: onMonthChanged,
            onSelectedChanged: onSelectedChanged,
          ),
        ),
      ),
      if (loading)
        const SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: CircularProgressIndicator(color: Color(0xFF0B74FA)),
          ),
        )
      else if (error != null)
        SliverFillRemaining(
          hasScrollBody: false,
          child: ScheduleEmptyState(
            error: error,
            title: 'Could not load this month',
          ),
        )
      else
        _DayAgendaSliver(
          selected: selected,
          appointments: appointments,
          onReload: onReload,
        ),
    ];
  }
}

class _MonthPlannerCard extends StatefulWidget {
  const _MonthPlannerCard({
    required this.month,
    required this.selected,
    required this.appointments,
    required this.onMonthChanged,
    required this.onSelectedChanged,
  });

  final DateTime month;
  final DateTime selected;
  final List<DoctorAppointment> appointments;
  final ValueChanged<DateTime> onMonthChanged;
  final ValueChanged<DateTime> onSelectedChanged;

  @override
  State<_MonthPlannerCard> createState() => _MonthPlannerCardState();
}

class _MonthPlannerCardState extends State<_MonthPlannerCard>
    with TickerProviderStateMixin {
  bool _expanded = true;
  late final AnimationController _expandCtrl;
  late final AnimationController _pulse;
  late final AnimationController _orbit;

  @override
  void initState() {
    super.initState();
    _expandCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
      value: 1,
    );
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _orbit = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..repeat();
  }

  @override
  void dispose() {
    _expandCtrl.dispose();
    _pulse.dispose();
    _orbit.dispose();
    super.dispose();
  }

  Set<int> get _busyDays {
    return widget.appointments
        .where((a) =>
            a.scheduledAt.year == widget.month.year &&
            a.scheduledAt.month == widget.month.month)
        .map((a) => a.scheduledAt.day)
        .toSet();
  }

  Map<int, int> get _countsByDay {
    final map = <int, int>{};
    for (final a in widget.appointments) {
      if (a.scheduledAt.year != widget.month.year ||
          a.scheduledAt.month != widget.month.month) {
        continue;
      }
      map[a.scheduledAt.day] = (map[a.scheduledAt.day] ?? 0) + 1;
    }
    return map;
  }

  List<DateTime> get _weekDays {
    final start =
        widget.selected.subtract(Duration(days: widget.selected.weekday % 7));
    return List.generate(7, (i) => DateTime(start.year, start.month, start.day + i));
  }

  void _toggleExpand() {
    HapticFeedback.selectionClick();
    setState(() => _expanded = !_expanded);
    if (_expanded) {
      _expandCtrl.forward();
    } else {
      _expandCtrl.reverse();
    }
  }

  void _pickDay(DateTime day) {
    HapticFeedback.lightImpact();
    if (day.month != widget.month.month || day.year != widget.month.year) {
      widget.onMonthChanged(DateTime(day.year, day.month));
    }
    widget.onSelectedChanged(DateTime(day.year, day.month, day.day));
  }

  void _shiftMonth(int delta) {
    HapticFeedback.selectionClick();
    final next = DateTime(widget.month.year, widget.month.month + delta);
    widget.onMonthChanged(next);
    final lastDay = DateTime(next.year, next.month + 1, 0).day;
    final day = math.min(widget.selected.day, lastDay);
    widget.onSelectedChanged(DateTime(next.year, next.month, day));
  }

  @override
  Widget build(BuildContext context) {
    final counts = _countsByDay;

    return AnimatedBuilder(
      animation: _orbit,
      builder: (_, __) {
        final t = _orbit.value * math.pi * 2;
        return Container(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            gradient: LinearGradient(
              begin: Alignment(-1 + math.cos(t) * 0.2, -1),
              end: Alignment(1, 1 + math.sin(t) * 0.15),
              colors: const [
                Color(0xFFFFFFFF),
                Color(0xFFF7FAFF),
                Color(0xFFFFFFFF),
              ],
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0B74FA).withValues(alpha: 0.12),
                blurRadius: 28,
                offset: Offset(0, 10 + 2 * math.sin(t)),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Appointment date',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1A1B1E),
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: _toggleExpand,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEEF4FF),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        children: [
                          Text(
                            DateFormat.MMMM().format(widget.month),
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0B74FA),
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(width: 2),
                          AnimatedRotation(
                            turns: _expanded ? 0 : 0.5,
                            duration: const Duration(milliseconds: 280),
                            child: const Icon(
                              Icons.expand_more_rounded,
                              size: 18,
                              color: Color(0xFF0B74FA),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  _RoundNav(
                    icon: Icons.chevron_left_rounded,
                    onTap: () => _shiftMonth(-1),
                  ),
                  Expanded(
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 280),
                      child: Text(
                        DateFormat.yMMMM().format(widget.month),
                        key: ValueKey('${widget.month.year}-${widget.month.month}'),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF1A1B1E),
                        ),
                      ),
                    ),
                  ),
                  _RoundNav(
                    icon: Icons.chevron_right_rounded,
                    onTap: () => _shiftMonth(1),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              SizeTransition(
                sizeFactor: CurvedAnimation(
                  parent: _expandCtrl,
                  curve: Curves.easeOutCubic,
                  reverseCurve: Curves.easeInCubic,
                ),
                child: FadeTransition(
                  opacity: _expandCtrl,
                  child: _MonthGrid(
                    month: widget.month,
                    selected: widget.selected,
                    busyDays: _busyDays,
                    counts: counts,
                    pulse: _pulse,
                    onSelect: _pickDay,
                  ),
                ),
              ),
              AnimatedBuilder(
                animation: _expandCtrl,
                builder: (_, __) {
                  if (_expandCtrl.value > 0.85) {
                    return const SizedBox.shrink();
                  }
                  return Opacity(
                    opacity: (1 - _expandCtrl.value).clamp(0.0, 1.0),
                    child: PremiumDateStrip(
                      days: _weekDays,
                      selected: widget.selected,
                      counts: counts,
                      onSelect: _pickDay,
                    ),
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }
}

class _RoundNav extends StatelessWidget {
  const _RoundNav({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF0B74FA),
      shape: const CircleBorder(),
      elevation: 3,
      shadowColor: const Color(0xFF0B74FA).withValues(alpha: 0.4),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 38,
          height: 38,
          child: Icon(icon, color: Colors.white, size: 22),
        ),
      ),
    );
  }
}

class _MonthGrid extends StatelessWidget {
  const _MonthGrid({
    required this.month,
    required this.selected,
    required this.busyDays,
    required this.counts,
    required this.pulse,
    required this.onSelect,
  });

  final DateTime month;
  final DateTime selected;
  final Set<int> busyDays;
  final Map<int, int> counts;
  final AnimationController pulse;
  final ValueChanged<DateTime> onSelect;

  static const _labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
    final today = DateTime.now();

    return Column(
      children: [
        Row(
          children: _labels
              .map(
                (d) => Expanded(
                  child: Center(
                    child: Text(
                      d,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF929296),
                        letterSpacing: 0.4,
                      ),
                    ),
                  ),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 8),
        ...List.generate(cells.length ~/ 7, (row) {
          final slice = cells.sublist(row * 7, row * 7 + 7);
          return Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              children: slice.asMap().entries.map((e) {
                final n = e.value;
                final delay = (row * 7 + e.key) * 18;
                if (n == null) {
                  return const Expanded(child: SizedBox(height: 48));
                }
                final day = DateTime(month.year, month.month, n);
                final isSelected = isSameDay(day, selected);
                final isToday = isSameDay(day, today);
                final count = counts[n] ?? 0;
                final busy = busyDays.contains(n);

                return Expanded(
                  child: FadeSlideIn(
                    delay: Duration(milliseconds: delay),
                    offset: const Offset(0, 0.12),
                    duration: const Duration(milliseconds: 320),
                    child: GestureDetector(
                      onTap: () => onSelect(day),
                      child: AnimatedBuilder(
                        animation: pulse,
                        builder: (_, __) {
                          final glow =
                              isSelected ? 0.18 + 0.12 * pulse.value : 0.0;
                          return AnimatedContainer(
                            duration: const Duration(milliseconds: 220),
                            curve: Curves.easeOutCubic,
                            height: 48,
                            margin: const EdgeInsets.symmetric(horizontal: 2),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(14),
                              gradient: isSelected
                                  ? const LinearGradient(
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                      colors: [
                                        Color(0xFF0B74FA),
                                        Color(0xFF0A66DE),
                                      ],
                                    )
                                  : null,
                              color: isSelected
                                  ? null
                                  : isToday
                                      ? const Color(0xFFEEF4FF)
                                      : Colors.transparent,
                              boxShadow: isSelected
                                  ? [
                                      BoxShadow(
                                        color: const Color(0xFF0B74FA)
                                            .withValues(alpha: glow),
                                        blurRadius: 14,
                                        spreadRadius: 1,
                                      ),
                                    ]
                                  : null,
                              border: isToday && !isSelected
                                  ? Border.all(
                                      color: const Color(0xFF0B74FA)
                                          .withValues(alpha: 0.4),
                                    )
                                  : null,
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  '$n',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: isSelected || isToday
                                        ? FontWeight.w800
                                        : FontWeight.w600,
                                    color: isSelected
                                        ? Colors.white
                                        : const Color(0xFF1A1B1E),
                                  ),
                                ),
                                const SizedBox(height: 3),
                                if (busy)
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: List.generate(
                                      math.min(count, 3),
                                      (i) => Container(
                                        width: 4,
                                        height: 4,
                                        margin: const EdgeInsets.symmetric(
                                          horizontal: 1,
                                        ),
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          color: isSelected
                                              ? Colors.white
                                              : Color.lerp(
                                                  const Color(0xFF0B74FA),
                                                  const Color(0xFFE65C00),
                                                  i / 3,
                                                ),
                                        ),
                                      ),
                                    ),
                                  )
                                else
                                  const SizedBox(height: 4),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          );
        }),
      ],
    );
  }
}

class _DayAgendaSliver extends StatelessWidget {
  const _DayAgendaSliver({
    required this.selected,
    required this.appointments,
    this.onReload,
  });

  final DateTime selected;
  final List<DoctorAppointment> appointments;
  final VoidCallback? onReload;

  List<DoctorAppointment> get _items {
    return appointments
        .where((a) => isSameDay(a.scheduledAt, selected))
        .toList()
      ..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    if (items.isEmpty) {
      return SliverToBoxAdapter(
        child: ExpandingPanel(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: ScheduleSoftCard(
            child: Column(
              children: [
                _headline(0),
                const Padding(
                  padding: EdgeInsets.only(top: 28, bottom: 12),
                  child: ScheduleEmptyState(
                    title: 'Clear day ahead',
                    subtitle:
                        'No visits booked — tap another date on the month map.',
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      sliver: SliverList(
        delegate: SliverChildBuilderDelegate(
          (context, i) {
            if (i == 0) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _headline(items.length),
              );
            }
            final a = items[i - 1];
            return AnimatedAppointmentTile(
              index: i - 1,
              child: AppointmentCard(
                appointment: Appointment.fromDoctor(a),
                onComplete: () => VisitActions.showCompleteSheet(
                  context,
                  patient: a.displayPatient,
                  time: a.timeLabel,
                  appointmentId: a.id,
                  patientId: a.patientId,
                  existingStoredNotes: a.storedNotes,
                  onDone: onReload,
                ),
                onReschedule: () => VisitActions.reschedule(
                  context,
                  appointmentId: a.id,
                  initial: a.scheduledAt,
                  onDone: onReload,
                ),
                onMarkArrived: a.status == 'REQUESTED'
                    ? () => VisitActions.markArrived(
                          context,
                          appointmentId: a.id,
                          onDone: onReload,
                        )
                    : null,
                onNoShow: () => VisitActions.markNoShow(
                  context,
                  appointmentId: a.id,
                  onDone: onReload,
                ),
                onCancel: () => VisitActions.cancel(
                  context,
                  appointmentId: a.id,
                  onDone: onReload,
                ),
              ),
            );
          },
          childCount: items.length + 1,
        ),
      ),
    );
  }

  Widget _headline(int count) {
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: const Color(0xFFEEF4FF),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(
            Icons.timeline_rounded,
            color: Color(0xFF0B74FA),
            size: 20,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                DateFormat('EEEE, MMM d').format(selected),
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1A1B1E),
                ),
              ),
              Text(
                count == 0 ? 'Nothing on the board' : '$count on the board',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF929296),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

}
