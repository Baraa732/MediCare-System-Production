import 'dart:math' as math;

import 'package:cms_doctor_app/core/utils/appointment_notes_util.dart';
import 'package:cms_doctor_app/core/api/services/appointment_api_service.dart';
import 'package:cms_doctor_app/core/utils/date_format.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:syncfusion_flutter_calendar/calendar.dart';

class VisitCardPalette {
  const VisitCardPalette({
    required this.fill,
    required this.accent,
    required this.icon,
  });

  final Color fill;
  final Color accent;
  final IconData icon;
}

VisitCardPalette visitPalette(String status) {
  switch (status) {
    case 'COMPLETED':
      return const VisitCardPalette(
        fill: Color(0xFFE8F6EE),
        accent: Color(0xFF2E7D32),
        icon: Icons.check_circle_rounded,
      );
    case 'CONFIRMED':
      return const VisitCardPalette(
        fill: Color(0xFFDCEEFF),
        accent: Color(0xFF0B74FA),
        icon: Icons.login_rounded,
      );
    case 'REQUESTED':
      return const VisitCardPalette(
        fill: Color(0xFFFFE8D6),
        accent: Color(0xFFE65C00),
        icon: Icons.hourglass_top_rounded,
      );
    case 'NO_SHOW':
      return const VisitCardPalette(
        fill: Color(0xFFFFE0E0),
        accent: Color(0xFFE53935),
        icon: Icons.heart_broken_rounded,
      );
    case 'CANCELLED':
      return const VisitCardPalette(
        fill: Color(0xFFF0F1F4),
        accent: Color(0xFF929296),
        icon: Icons.block_rounded,
      );
    default:
      return const VisitCardPalette(
        fill: Color(0xFFEDE7FF),
        accent: Color(0xFF6C5CE7),
        icon: Icons.medical_services_outlined,
      );
  }
}

class DoctorCalendarDataSource extends CalendarDataSource {
  DoctorCalendarDataSource(List<Appointment> source) {
    appointments = source;
  }
}

/// Today-only vertical day board — no week strip, no horizontal day swipe.
/// Sized to the full clinic day so the parent page scroll owns vertical motion.
class AdvancedDayTimeline extends StatelessWidget {
  const AdvancedDayTimeline({
    super.key,
    required this.day,
    required this.appointments,
    required this.hoursLabel,
    required this.closed,
    required this.loading,
    required this.error,
    required this.controller,
    required this.dataSource,
    required this.specialRegions,
    required this.startHour,
    required this.endHour,
    required this.onAppointmentTap,
    required this.onAppointmentLongPress,
    this.onRefresh,
  });

  static const double slotHeight = 42;
  static const int slotMinutes = 15;

  final DateTime day;
  final List<DoctorAppointment> appointments;
  final String hoursLabel;
  final bool closed;
  final bool loading;
  final String? error;
  final CalendarController controller;
  final CalendarDataSource dataSource;
  final List<TimeRegion> specialRegions;
  final double startHour;
  final double endHour;
  final void Function(DoctorAppointment appointment) onAppointmentTap;
  final void Function(DoctorAppointment appointment) onAppointmentLongPress;
  final Future<void> Function()? onRefresh;

  /// Full grid height for all slots — parent scrolls; calendar must not.
  double get calendarExtent {
    final hours = (endHour - startHour).clamp(1.0, 24.0);
    final slots = (hours * 60 / slotMinutes).ceil();
    // Extra padding so Syncfusion maxScrollExtent stays ~0 (page owns scroll).
    return slots * slotHeight + 12;
  }

  Map<String, DoctorAppointment> get _byId => {
        for (final a in appointments) a.id: a,
      };

  @override
  Widget build(BuildContext context) {
    final screenH = MediaQuery.sizeOf(context).height;

    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 4, 10, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          _TodayBoardHeader(
            day: day,
            hoursLabel: hoursLabel,
            closed: closed,
            visitCount: appointments.length,
            onRefresh: onRefresh,
          ),
          const SizedBox(height: 12),
          if (loading)
            _BoardShell(
              child: SizedBox(
                height: math.max(calendarExtent, screenH * 0.55),
                child: const Center(
                  child: CircularProgressIndicator(color: Color(0xFF0B74FA)),
                ),
              ),
            )
          else if (error != null)
            _BoardShell(
              child: SizedBox(
                height: math.max(280, screenH * 0.35),
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.cloud_off_rounded,
                          color: Color(0xFFE53935),
                          size: 36,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Color(0xFFE53935),
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            )
          else
            _BoardShell(
              child: SizedBox(
                // Slightly taller than slot math so Syncfusion has no inner scroll
                // range — the page CustomScrollView owns all vertical motion.
                height: calendarExtent,
                width: double.infinity,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(24),
                  child: MediaQuery.removePadding(
                    context: context,
                    removeTop: true,
                    removeBottom: true,
                    child: ScrollConfiguration(
                      // Force Syncfusion's inner Scrollable to never compete —
                      // the page CustomScrollView owns vertical motion.
                      behavior: const _PassThroughScrollBehavior(),
                      child: SfCalendar(
                      key: ValueKey('today-${day.toIso8601String()}'),
                      controller: controller,
                      view: CalendarView.day,
                      dataSource: dataSource,
                      initialDisplayDate: day,
                      firstDayOfWeek: DateTime.sunday,
                      headerHeight: 0,
                      viewHeaderHeight: 0,
                      cellEndPadding: 12,
                      showCurrentTimeIndicator: true,
                      todayHighlightColor: const Color(0xFFFF375F),
                      backgroundColor: Colors.white,
                      cellBorderColor: const Color(0xFFE8EAF0),
                      allowViewNavigation: false,
                      allowDragAndDrop: false,
                      allowAppointmentResize: false,
                      viewNavigationMode: ViewNavigationMode.none,
                      specialRegions: specialRegions,
                      selectionDecoration:
                          const BoxDecoration(color: Colors.transparent),
                      timeRegionBuilder: _regionBuilder,
                      appointmentBuilder: _appointmentBuilder,
                      onTap: (details) {
                        final apt = _resolve(details.appointments);
                        if (apt != null) onAppointmentTap(apt);
                      },
                      onLongPress: (details) {
                        final apt = _resolve(details.appointments);
                        if (apt != null) onAppointmentLongPress(apt);
                      },
                      timeSlotViewSettings: TimeSlotViewSettings(
                        startHour: startHour,
                        endHour: endHour,
                        timeInterval: const Duration(minutes: slotMinutes),
                        timeIntervalHeight: slotHeight,
                        timeFormat: 'HH:mm',
                        timeRulerSize: 62,
                        minimumAppointmentDuration:
                            const Duration(minutes: 15),
                        numberOfDaysInView: 1,
                        nonWorkingDays: const <int>[],
                        timeTextStyle: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF9AA0AE),
                          letterSpacing: -0.2,
                        ),
                      ),
                    ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  DoctorAppointment? _resolve(List<dynamic>? raw) {
    if (raw == null || raw.isEmpty) return null;
    final first = raw.first;
    if (first is Appointment) {
      return _byId[first.id?.toString()];
    }
    return null;
  }

  Widget _regionBuilder(BuildContext context, TimeRegionDetails details) {
    final closed = details.region.text == 'Closed';
    return ColoredBox(
      color: closed ? const Color(0xFFF0F2F6) : const Color(0xFFF7F8FB),
      child: closed
          ? const Align(
              alignment: Alignment.topCenter,
              child: Padding(
                padding: EdgeInsets.only(top: 10),
                child: Text(
                  'Clinic closed',
                  style: TextStyle(
                    color: Color(0xFF929296),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            )
          : const SizedBox.expand(),
    );
  }

  Widget _appointmentBuilder(
    BuildContext context,
    CalendarAppointmentDetails details,
  ) {
    if (details.appointments.isEmpty) return const SizedBox.shrink();
    final sfApt = details.appointments.first;
    DoctorAppointment? doctorApt;
    if (sfApt is Appointment) {
      doctorApt = _byId[sfApt.id?.toString()];
    }
    if (doctorApt == null) return const SizedBox.shrink();
    return SizedBox(
      width: details.bounds.width,
      height: details.bounds.height,
      child: VisitAppointmentBlock(
        appointment: doctorApt,
        height: details.bounds.height,
        width: details.bounds.width,
      ),
    );
  }
}

class _BoardShell extends StatelessWidget {
  const _BoardShell({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0B74FA).withValues(alpha: 0.08),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: child,
    );
  }
}

/// Disables descendant scrollables so the parent page owns vertical drag.
class _PassThroughScrollBehavior extends ScrollBehavior {
  const _PassThroughScrollBehavior();

  @override
  ScrollPhysics getScrollPhysics(BuildContext context) {
    return const NeverScrollableScrollPhysics();
  }

  @override
  Widget buildOverscrollIndicator(
    BuildContext context,
    Widget child,
    ScrollableDetails details,
  ) {
    return child;
  }
}

class _TodayBoardHeader extends StatelessWidget {
  const _TodayBoardHeader({
    required this.day,
    required this.hoursLabel,
    required this.closed,
    required this.visitCount,
    this.onRefresh,
  });

  final DateTime day;
  final String hoursLabel;
  final bool closed;
  final int visitCount;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE8EAF0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF0B74FA), Color(0xFF0A66DE)],
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  DateFormat('EEE').format(day).toUpperCase(),
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    color: Colors.white.withValues(alpha: 0.85),
                    letterSpacing: 0.4,
                  ),
                ),
                Text(
                  '${day.day}',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    height: 1.05,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "Today's schedule",
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1A1B1E),
                    letterSpacing: -0.3,
                    height: 1.15,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '${DateFormat('MMMM d, y').format(day)}  ·  $hoursLabel',
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
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            decoration: BoxDecoration(
              color: closed
                  ? const Color(0xFFF0F1F4)
                  : const Color(0xFFEEF4FF),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              closed ? 'Closed' : '$visitCount visits',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 12,
                color: closed
                    ? const Color(0xFF929296)
                    : const Color(0xFF0B74FA),
              ),
            ),
          ),
          if (onRefresh != null)
            IconButton(
              visualDensity: VisualDensity.compact,
              tooltip: 'Refresh',
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh_rounded, color: Color(0xFF0B74FA)),
            ),
        ],
      ),
    );
  }
}

class VisitAppointmentBlock extends StatelessWidget {
  const VisitAppointmentBlock({
    super.key,
    required this.appointment,
    required this.height,
    this.width = 200,
  });

  final DoctorAppointment appointment;
  final double height;
  final double width;

  @override
  Widget build(BuildContext context) {
    final palette = visitPalette(appointment.status);
    final end = appointment.scheduledAt.add(
      Duration(minutes: appointment.durationMinutes),
    );
    final timeRange =
        '${DateFormat.jm().format(appointment.scheduledAt)} – ${DateFormat.jm().format(end)}';
    final narrow = width < 72;
    final compact = height < 38 || narrow;
    final medium = height < 58 || narrow;
    final reason = (appointment.reason ?? '').trim();
    final hasNotes = hasDisplayNotes(appointment.storedNotes);
    final label = narrow
        ? appointment.displayPatient.split(' ').first
        : compact
            ? appointment.displayPatient
            : timeRange;

    return Container(
      margin: EdgeInsets.only(right: narrow ? 1 : 4, bottom: 1),
      clipBehavior: Clip.hardEdge,
      decoration: BoxDecoration(
        color: palette.fill,
        borderRadius: BorderRadius.circular(narrow ? 8 : 12),
        border: Border.all(
          color: palette.accent.withValues(alpha: 0.18),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            width: narrow ? 3 : 5,
            color: palette.accent,
          ),
          Expanded(
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                narrow ? 4 : 8,
                compact ? 3 : 7,
                narrow ? 3 : 8,
                compact ? 3 : 7,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.max,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          label,
                          maxLines: narrow ? 2 : 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: narrow ? 9 : (compact ? 12 : 11),
                            fontWeight: FontWeight.w800,
                            color: palette.accent,
                            height: 1.1,
                          ),
                        ),
                      ),
                      if (!compact) ...[
                        Icon(palette.icon, size: 13, color: palette.accent),
                        if (hasNotes) ...[
                          const SizedBox(width: 4),
                          Icon(
                            Icons.chat_bubble_rounded,
                            size: 12,
                            color: palette.accent.withValues(alpha: 0.85),
                          ),
                        ],
                      ],
                    ],
                  ),
                  if (!compact) ...[
                    const SizedBox(height: 3),
                    Text(
                      appointment.displayPatient,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF1A1B1E),
                        height: 1.15,
                      ),
                    ),
                  ],
                  if (!medium && reason.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      '• $reason',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF6B7280),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SoftRegionPainter extends CustomPainter {
  const _SoftRegionPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final fill = Paint()..color = const Color(0xFFF7F8FB);
    canvas.drawRect(Offset.zero & size, fill);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

int weekDateKey(DateTime d) => d.year * 10000 + d.month * 100 + d.day;

DateTime sundayWeekStart(DateTime day) {
  final date = DateTime(day.year, day.month, day.day);
  return date.subtract(Duration(days: date.weekday % 7));
}

DateTime mondayWeekStart(DateTime day) {
  final date = DateTime(day.year, day.month, day.day);
  return date.subtract(Duration(days: date.weekday - 1));
}

Appointment toCalendarAppointment(DoctorAppointment a) {
  final palette = visitPalette(a.status);
  var end = a.scheduledAt.add(Duration(minutes: a.durationMinutes));
  if (!end.isAfter(a.scheduledAt)) {
    end = a.scheduledAt.add(const Duration(minutes: 15));
  }
  // Syncfusion moves spans longer than 24h into the all-day panel.
  if (end.difference(a.scheduledAt) >= const Duration(hours: 24)) {
    end = a.scheduledAt.add(const Duration(hours: 23, minutes: 59));
  }
  return Appointment(
    id: a.id,
    startTime: a.scheduledAt,
    endTime: end,
    subject: a.displayPatient,
    notes: a.reason,
    color: palette.accent,
  );
}

List<TimeRegion> clinicTimeRegions({
  required List<DateTime> weekDays,
  required Map<int, Map<String, dynamic>> hoursByDay,
  required double startHour,
  required double endHour,
  required int Function(String hhmm, {int fallback}) parseMinutes,
}) {
  final regions = <TimeRegion>[];
  final startMins = (startHour * 60).round();
  final endMins = math.min(24 * 60, (endHour * 60).round());

  for (final day in weekDays) {
    final slot = hoursByDay[day.weekday % 7];
    DateTime at(int mins) {
      final clamped = mins.clamp(0, 24 * 60 - 1);
      return DateTime(day.year, day.month, day.day, clamped ~/ 60, clamped % 60);
    }

    if (slot == null) continue;
    if (slot['isClosed'] == true) {
      regions.add(
        TimeRegion(
          startTime: at(startMins),
          endTime: at(endMins == 24 * 60 ? 24 * 60 - 1 : endMins),
          enablePointerInteraction: false,
          color: const Color(0xFFF3F4F7),
          text: 'Closed',
        ),
      );
      continue;
    }

    final open = parseMinutes(slot['openTime']?.toString() ?? '09:00');
    final close = parseMinutes(
      slot['closeTime']?.toString() ?? '17:00',
      fallback: 17 * 60,
    );

    if (open > startMins) {
      regions.add(
        TimeRegion(
          startTime: at(startMins),
          endTime: at(open),
          enablePointerInteraction: false,
          color: const Color(0xFFF7F8FB),
          text: 'Unavailable',
        ),
      );
    }
    if (close < endMins) {
      regions.add(
        TimeRegion(
          startTime: at(close),
          endTime: at(endMins == 24 * 60 ? 24 * 60 - 1 : endMins),
          enablePointerInteraction: false,
          color: const Color(0xFFF7F8FB),
          text: 'Unavailable',
        ),
      );
    }
  }
  return regions;
}

/// Week board — kept for Week tab (horizontal multi-day is intentional there).
class AdvancedWeekCalendar extends StatelessWidget {
  const AdvancedWeekCalendar({
    super.key,
    required this.weekStart,
    required this.weekDays,
    required this.appointments,
    required this.rangeLabel,
    required this.loading,
    required this.error,
    required this.controller,
    required this.dataSource,
    required this.specialRegions,
    required this.startHour,
    required this.endHour,
    required this.onPrevWeek,
    required this.onNextWeek,
    required this.onThisWeek,
    required this.onAppointmentTap,
    required this.onAppointmentLongPress,
    this.onRefresh,
  });

  final DateTime weekStart;
  final List<DateTime> weekDays;
  final List<DoctorAppointment> appointments;
  final String rangeLabel;
  final bool loading;
  final String? error;
  final CalendarController controller;
  final CalendarDataSource dataSource;
  final List<TimeRegion> specialRegions;
  final double startHour;
  final double endHour;
  final VoidCallback onPrevWeek;
  final VoidCallback onNextWeek;
  final VoidCallback onThisWeek;
  final void Function(DoctorAppointment appointment) onAppointmentTap;
  final void Function(DoctorAppointment appointment) onAppointmentLongPress;
  final Future<void> Function()? onRefresh;

  bool get _isThisWeek => isSameDay(weekStart, mondayWeekStart(DateTime.now()));

  Map<String, DoctorAppointment> get _byId => {
        for (final a in appointments) a.id: a,
      };

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
      child: Column(
        children: [
          _WeekBoardHeader(
            rangeLabel: rangeLabel,
            isThisWeek: _isThisWeek,
            visitCount: appointments.length,
            onPrev: onPrevWeek,
            onNext: onNextWeek,
            onThisWeek: onThisWeek,
            onRefresh: onRefresh,
          ),
          const SizedBox(height: 8),
          _WeekDateNumbers(days: weekDays),
          const SizedBox(height: 8),
          Expanded(child: _buildBoard()),
        ],
      ),
    );
  }

  Widget _buildBoard() {
    if (loading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF0B74FA)),
      );
    }
    if (error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Text(
            error!,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.red, fontSize: 14),
          ),
        ),
      );
    }

    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0B74FA).withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: SfCalendar(
          key: ValueKey('week-${weekStart.toIso8601String()}'),
          controller: controller,
          view: CalendarView.week,
          dataSource: dataSource,
          initialDisplayDate: weekStart,
          firstDayOfWeek: DateTime.monday,
          headerHeight: 0,
          viewHeaderHeight: 0,
          cellEndPadding: 2,
          showCurrentTimeIndicator: true,
          todayHighlightColor: const Color(0xFFFF375F),
          backgroundColor: Colors.white,
          cellBorderColor: const Color(0xFFE8EAF0),
          allowViewNavigation: false,
          allowDragAndDrop: false,
          allowAppointmentResize: false,
          viewNavigationMode: ViewNavigationMode.none,
          specialRegions: specialRegions,
          selectionDecoration: const BoxDecoration(color: Colors.transparent),
          timeRegionBuilder: (context, details) => CustomPaint(
            painter: const _SoftRegionPainter(),
            child: const SizedBox.expand(),
          ),
          appointmentBuilder: (context, details) {
            if (details.appointments.isEmpty) return const SizedBox.shrink();
            final raw = details.appointments.first;
            if (raw is! Appointment) return const SizedBox.shrink();
            final apt = _byId[raw.id?.toString()];
            if (apt == null) return const SizedBox.shrink();
            return SizedBox(
              width: details.bounds.width,
              height: details.bounds.height,
              child: VisitAppointmentBlock(
                appointment: apt,
                height: details.bounds.height,
                width: details.bounds.width,
              ),
            );
          },
          onTap: (details) {
            final first = details.appointments?.isNotEmpty == true
                ? details.appointments!.first
                : null;
            if (first is Appointment) {
              final apt = _byId[first.id?.toString()];
              if (apt != null) onAppointmentTap(apt);
            }
          },
          onLongPress: (details) {
            final first = details.appointments?.isNotEmpty == true
                ? details.appointments!.first
                : null;
            if (first is Appointment) {
              final apt = _byId[first.id?.toString()];
              if (apt != null) onAppointmentLongPress(apt);
            }
          },
          timeSlotViewSettings: TimeSlotViewSettings(
            startHour: startHour,
            endHour: endHour,
            timeInterval: const Duration(minutes: 30),
            timeIntervalHeight: 36,
            timeFormat: 'HH:mm',
            timeRulerSize: 46,
            minimumAppointmentDuration: const Duration(minutes: 15),
            numberOfDaysInView: 7,
            nonWorkingDays: const <int>[],
            timeTextStyle: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: Color(0xFF9AA0AE),
            ),
          ),
        ),
      ),
    );
  }
}

class _WeekBoardHeader extends StatelessWidget {
  const _WeekBoardHeader({
    required this.rangeLabel,
    required this.isThisWeek,
    required this.visitCount,
    required this.onPrev,
    required this.onNext,
    required this.onThisWeek,
    this.onRefresh,
  });

  final String rangeLabel;
  final bool isThisWeek;
  final int visitCount;
  final VoidCallback onPrev;
  final VoidCallback onNext;
  final VoidCallback onThisWeek;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _RoundNav(icon: Icons.chevron_left_rounded, onTap: onPrev),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            children: [
              Text(
                rangeLabel,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1A1B1E),
                  letterSpacing: -0.3,
                ),
              ),
              Text(
                '$visitCount visits',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF929296),
                ),
              ),
            ],
          ),
        ),
        _RoundNav(icon: Icons.chevron_right_rounded, onTap: onNext),
        if (!isThisWeek) ...[
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onThisWeek,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF0B74FA),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text(
                'This week',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 11,
                ),
              ),
            ),
          ),
        ],
        if (onRefresh != null)
          IconButton(
            visualDensity: VisualDensity.compact,
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF0B74FA)),
          ),
      ],
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
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: SizedBox(
          width: 36,
          height: 36,
          child: Icon(icon, color: Colors.white),
        ),
      ),
    );
  }
}

class _WeekDateNumbers extends StatelessWidget {
  const _WeekDateNumbers({required this.days});

  final List<DateTime> days;

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          const SizedBox(width: 46),
          for (final day in days)
            Expanded(
              child: Container(
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: isSameDay(day, today)
                      ? const Color(0xFF0B74FA)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${day.day}',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: isSameDay(day, today)
                        ? Colors.white
                        : const Color(0xFF1A1B1E),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
