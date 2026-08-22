import 'package:cms_doctor_app/core/api/services/appointment_api_service.dart';
import 'package:cms_doctor_app/core/utils/date_format.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import 'advanced_day_timeline.dart';

/// Six upcoming days (tomorrow → +5), each as an advanced expandable day list.
class AdvancedWeekAgenda extends StatelessWidget {
  const AdvancedWeekAgenda({
    super.key,
    required this.days,
    required this.appointmentsByDay,
    required this.expandedKeys,
    required this.loading,
    required this.error,
    required this.onToggleDay,
    required this.onAppointmentTap,
    required this.onAppointmentLongPress,
    this.onRefresh,
    this.rangeLabel = '',
  });

  final List<DateTime> days;
  final Map<int, List<DoctorAppointment>> appointmentsByDay;
  final Set<int> expandedKeys;
  final bool loading;
  final String? error;
  final ValueChanged<DateTime> onToggleDay;
  final void Function(DoctorAppointment appointment) onAppointmentTap;
  final void Function(DoctorAppointment appointment) onAppointmentLongPress;
  final Future<void> Function()? onRefresh;
  final String rangeLabel;

  static int dayKey(DateTime d) => d.year * 10000 + d.month * 100 + d.day;

  @override
  Widget build(BuildContext context) {
    final total = appointmentsByDay.values.fold<int>(0, (n, list) => n + list.length);

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          _WeekAgendaHeader(
            rangeLabel: rangeLabel,
            total: total,
            dayCount: days.length,
            onRefresh: onRefresh,
          ),
          const SizedBox(height: 12),
          if (loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 64),
              child: Center(
                child: CircularProgressIndicator(color: Color(0xFF0B74FA)),
              ),
            )
          else if (error != null)
            _ErrorState(message: error!)
          else
            for (var i = 0; i < days.length; i++) ...[
              if (i > 0) const SizedBox(height: 10),
              _DayExpandPanel(
                day: days[i],
                index: i,
                appointments: appointmentsByDay[dayKey(days[i])] ?? const [],
                expanded: expandedKeys.contains(dayKey(days[i])),
                onToggle: () => onToggleDay(days[i]),
                onAppointmentTap: onAppointmentTap,
                onAppointmentLongPress: onAppointmentLongPress,
              ),
            ],
        ],
      ),
    );
  }
}

class _WeekAgendaHeader extends StatelessWidget {
  const _WeekAgendaHeader({
    required this.rangeLabel,
    required this.total,
    required this.dayCount,
    this.onRefresh,
  });

  final String rangeLabel;
  final int total;
  final int dayCount;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F8FB),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE8EAF0)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF0B74FA), Color(0xFF0A66DE)],
              ),
            ),
            child: const Icon(
              Icons.view_agenda_rounded,
              color: Colors.white,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Next 6 days',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1A1B1E),
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  rangeLabel.isEmpty
                      ? '$dayCount days · $total visits'
                      : '$rangeLabel · $total visits',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF929296),
                  ),
                ),
              ],
            ),
          ),
          if (onRefresh != null)
            IconButton(
              tooltip: 'Refresh',
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh_rounded, color: Color(0xFF0B74FA)),
            ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 16),
      child: Column(
        children: [
          const Icon(Icons.cloud_off_rounded, color: Color(0xFFE53935), size: 36),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Color(0xFFE53935),
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _DayExpandPanel extends StatelessWidget {
  const _DayExpandPanel({
    required this.day,
    required this.index,
    required this.appointments,
    required this.expanded,
    required this.onToggle,
    required this.onAppointmentTap,
    required this.onAppointmentLongPress,
  });

  final DateTime day;
  final int index;
  final List<DoctorAppointment> appointments;
  final bool expanded;
  final VoidCallback onToggle;
  final void Function(DoctorAppointment appointment) onAppointmentTap;
  final void Function(DoctorAppointment appointment) onAppointmentLongPress;

  bool get _isTomorrow {
    final now = DateTime.now();
    final tomorrow = DateTime(now.year, now.month, now.day)
        .add(const Duration(days: 1));
    return isSameDay(day, tomorrow);
  }

  @override
  Widget build(BuildContext context) {
    final count = appointments.length;
    final accent = count == 0
        ? const Color(0xFF929296)
        : const Color(0xFF0B74FA);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: expanded
              ? const Color(0xFF0B74FA).withValues(alpha: 0.35)
              : const Color(0xFFE8EAF0),
          width: expanded ? 1.4 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0B74FA).withValues(
              alpha: expanded ? 0.10 : 0.04,
            ),
            blurRadius: expanded ? 20 : 10,
            offset: Offset(0, expanded ? 8 : 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () {
                HapticFeedback.selectionClick();
                onToggle();
              },
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                child: Row(
                  children: [
                    _DayBadge(
                      day: day,
                      highlighted: _isTomorrow || expanded,
                      index: index,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  _isTomorrow
                                      ? 'Tomorrow'
                                      : DateFormat('EEEE').format(day),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF1A1B1E),
                                    letterSpacing: -0.2,
                                  ),
                                ),
                              ),
                              if (_isTomorrow) ...[
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 3,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFEEF4FF),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Text(
                                    'Next',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFF0B74FA),
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(
                            DateFormat('MMMM d, y').format(day),
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF929296),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: count == 0
                            ? const Color(0xFFF2F2F2)
                            : const Color(0xFFEEF4FF),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        count == 0 ? 'Free' : '$count visit${count == 1 ? '' : 's'}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: accent,
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                    AnimatedRotation(
                      turns: expanded ? 0.5 : 0,
                      duration: const Duration(milliseconds: 240),
                      child: Icon(
                        Icons.keyboard_arrow_down_rounded,
                        color: expanded
                            ? const Color(0xFF0B74FA)
                            : const Color(0xFF929296),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          AnimatedCrossFade(
            firstChild: const SizedBox(width: double.infinity, height: 0),
            secondChild: _DayAppointmentsBody(
              appointments: appointments,
              onAppointmentTap: onAppointmentTap,
              onAppointmentLongPress: onAppointmentLongPress,
            ),
            crossFadeState: expanded
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 260),
            sizeCurve: Curves.easeOutCubic,
          ),
        ],
      ),
    );
  }
}

class _DayBadge extends StatelessWidget {
  const _DayBadge({
    required this.day,
    required this.highlighted,
    required this.index,
  });

  final DateTime day;
  final bool highlighted;
  final int index;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 240),
      width: 48,
      height: 52,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        gradient: highlighted
            ? const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF0B74FA), Color(0xFF0A66DE)],
              )
            : null,
        color: highlighted ? null : const Color(0xFFF2F2F2),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            DateFormat('EEE').format(day).toUpperCase(),
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.4,
              color: highlighted
                  ? Colors.white.withValues(alpha: 0.85)
                  : const Color(0xFF929296),
            ),
          ),
          Text(
            '${day.day}',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              height: 1.05,
              color: highlighted ? Colors.white : const Color(0xFF1A1B1E),
            ),
          ),
        ],
      ),
    );
  }
}

class _DayAppointmentsBody extends StatelessWidget {
  const _DayAppointmentsBody({
    required this.appointments,
    required this.onAppointmentTap,
    required this.onAppointmentLongPress,
  });

  final List<DoctorAppointment> appointments;
  final void Function(DoctorAppointment appointment) onAppointmentTap;
  final void Function(DoctorAppointment appointment) onAppointmentLongPress;

  @override
  Widget build(BuildContext context) {
    if (appointments.isEmpty) {
      return const Padding(
        padding: EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: _EmptyDayCard(),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      child: Column(
        children: [
          const Divider(height: 1, color: Color(0xFFEEF0F4)),
          const SizedBox(height: 10),
          for (var i = 0; i < appointments.length; i++) ...[
            if (i > 0) const SizedBox(height: 8),
            _AppointmentDropRow(
              appointment: appointments[i],
              onTap: () => onAppointmentTap(appointments[i]),
              onLongPress: () => onAppointmentLongPress(appointments[i]),
            ),
          ],
        ],
      ),
    );
  }
}

class _EmptyDayCard extends StatelessWidget {
  const _EmptyDayCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 14),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F8FB),
        borderRadius: BorderRadius.circular(14),
      ),
      child: const Row(
        children: [
          Icon(Icons.event_available_rounded, color: Color(0xFF9AA0AE), size: 20),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'No visits booked for this day.',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF929296),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AppointmentDropRow extends StatelessWidget {
  const _AppointmentDropRow({
    required this.appointment,
    required this.onTap,
    required this.onLongPress,
  });

  final DoctorAppointment appointment;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  @override
  Widget build(BuildContext context) {
    final palette = visitPalette(appointment.status);
    final end = appointment.scheduledAt.add(
      Duration(minutes: appointment.durationMinutes),
    );
    final range =
        '${DateFormat.jm().format(appointment.scheduledAt)} – ${DateFormat.jm().format(end)}';
    final reason = (appointment.reason ?? '').trim();
    final statusLabel = appointment.uiStatus ??
        (appointment.status == 'REQUESTED' ? 'Pending' : appointment.status);

    return Material(
      color: palette.fill,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        onLongPress: onLongPress,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(10, 10, 12, 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 4,
                height: 46,
                decoration: BoxDecoration(
                  color: palette.accent,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(palette.icon, size: 14, color: palette.accent),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            range,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: palette.accent,
                            ),
                          ),
                        ),
                        Text(
                          appointment.durationLabel,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: palette.accent.withValues(alpha: 0.85),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      appointment.displayPatient,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1A1B1E),
                      ),
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 7,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.7),
                            borderRadius: BorderRadius.circular(7),
                          ),
                          child: Text(
                            statusLabel,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: palette.accent,
                            ),
                          ),
                        ),
                        if (reason.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              reason,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF6B7280),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              const Icon(
                Icons.chevron_right_rounded,
                color: Color(0xFFB0B4C0),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
