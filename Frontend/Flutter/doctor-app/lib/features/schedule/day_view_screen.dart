import 'package:cms_doctor_app/core/utils/date_format.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/layout/app_shell.dart';
import '../../core/navigation/app_navigation.dart';
import 'complete_visit_sheet.dart';
import 'models/appointment.dart';
import 'widgets/schedule_chrome.dart';
import 'widgets/schedule_filter.dart';
import 'widgets/schedule_workspace.dart';

class DayViewScreen extends StatefulWidget {
  const DayViewScreen({super.key, this.showEmpty = false});
  final bool showEmpty;

  @override
  State<DayViewScreen> createState() => _DayViewScreenState();
}

class _DayViewScreenState extends State<DayViewScreen> {
  final int _navIndex = 0;
  DateTime _selectedDate = DateTime.now();
  AdvancedScheduleFilter _filter = AdvancedScheduleFilter.empty;
  List<Appointment> _appointments = [];
  bool _loading = true;
  String? _error;
  int _orbitIndex = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dayStart = DateTime(
        _selectedDate.year,
        _selectedDate.month,
        _selectedDate.day,
      );
      final dayEnd = dayStart.add(const Duration(days: 1));
      final list = await appointmentApi.getMySchedule(from: dayStart, to: dayEnd);
      if (!mounted) return;
      setState(() {
        _appointments = list.map(Appointment.fromDoctor).toList();
        _loading = false;
        _orbitIndex = 0;
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

  List<Appointment> get _visibleAppointments => _filter.apply(_appointments);

  int get _completedCount =>
      _appointments.where((a) => a.status == 'Completed').length;
  int get _pendingCount =>
      _appointments.where((a) => a.status == null || a.status == 'Pending').length;
  int get _arrivedCount =>
      _appointments.where((a) => a.status == 'Arrived').length;

  Map<String, int> get _statusCounts => {
        'Pending': _pendingCount,
        'Arrived': _arrivedCount,
        'Completed': _completedCount,
      };

  List<DateTime> get _stripDays {
    final base = DateTime(
      _selectedDate.year,
      _selectedDate.month,
      _selectedDate.day,
    );
    return List.generate(
      14,
      (i) => base.subtract(const Duration(days: 3)).add(Duration(days: i)),
    );
  }

  void _goToPreviousDay() {
    setState(() => _selectedDate = _selectedDate.subtract(const Duration(days: 1)));
    _load();
  }

  void _goToNextDay() {
    setState(() => _selectedDate = _selectedDate.add(const Duration(days: 1)));
    _load();
  }

  void _goToToday() {
    setState(() => _selectedDate = DateTime.now());
    _load();
  }

  Future<void> _openFilter() async {
    final result = await showAdvancedScheduleFilterSheet(
      context: context,
      initial: _filter,
      statusCounts: _statusCounts,
    );
    if (result != null && mounted) {
      setState(() => _filter = result);
    }
  }

  Future<void> _markCompleted(Appointment apt, String notes) async {
    try {
      if (notes.trim().isNotEmpty) {
        await appointmentApi.updateNotes(apt.id, notes.trim());
      }
      await appointmentApi.updateStatus(apt.id, 'COMPLETED');
      await _load();
      if (mounted) showSnack(context, 'Visit marked completed');
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    }
  }

  Future<void> _markArrived(Appointment apt) async {
    try {
      await appointmentApi.updateStatus(apt.id, 'CONFIRMED');
      await _load();
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    }
  }

  Future<void> _reschedule(Appointment apt) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
    );
    if (time == null || !mounted) return;
    final scheduled = DateTime(
      picked.year,
      picked.month,
      picked.day,
      time.hour,
      time.minute,
    );
    try {
      await appointmentApi.reschedule(apt.id, scheduled);
      await _load();
      if (mounted) showSnack(context, 'Appointment rescheduled');
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    }
  }

  Color _accentFor(Appointment a) {
    if (a.status == 'Completed') return const Color(0xFF2E7D32);
    if (a.status == 'Arrived') return const Color(0xFF0B74FA);
    if (a.rawStatus == 'REQUESTED' || a.status == 'Pending') {
      return const Color(0xFFE65C00);
    }
    return const Color(0xFF0B74FA);
  }

  @override
  Widget build(BuildContext context) {
    final visible = _visibleAppointments;
    final showEmpty = !_loading && (_error != null || visible.isEmpty);
    final isToday = isSameDay(_selectedDate, DateTime.now());
    final total = _appointments.length;
    final doneProgress = total == 0 ? 0.0 : _completedCount / total;
    final pendingProgress = total == 0 ? 0.0 : _pendingCount / total;
    final arrivedProgress = total == 0 ? 0.0 : _arrivedCount / total;
    final safeOrbit =
        visible.isEmpty ? 0 : _orbitIndex.clamp(0, visible.length - 1);

    return Scaffold(
      backgroundColor: const Color(0xFFF2F2F2),
      body: ScheduleWorkspace(
        activeTab: 0,
        boardCaption: total == 0
            ? 'Your care board is ready — no visits yet.'
            : '$total patients lined up for this day.',
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
              child: Column(
                children: [
                  ScheduleCommandBar(
                    title: formatScheduleDate(_selectedDate),
                    subtitle:
                        '${visible.length} on board${_filter.isActive ? ' · filtered' : ''}',
                    onPrev: _goToPreviousDay,
                    onNext: _goToNextDay,
                    onCenter: _goToToday,
                    centerLabel: isToday ? 'Jump to now' : 'Back to today',
                    centerActive: isToday,
                    filter: _filter,
                    onOpenFilter: _openFilter,
                    onClearFilter: () =>
                        setState(() => _filter = AdvancedScheduleFilter.empty),
                  ),
                  const SizedBox(height: 14),
                  FadeSlideIn(
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(12, 14, 12, 14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(22),
                        boxShadow: [
                          BoxShadow(
                            color:
                                const Color(0xFF0B74FA).withValues(alpha: 0.08),
                            blurRadius: 18,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Text(
                                'Appointment date',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF1A1B1E),
                                ),
                              ),
                              const Spacer(),
                              Container(
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
                                      DateFormat.MMMM().format(_selectedDate),
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF0B74FA),
                                        fontSize: 13,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    const Icon(
                                      Icons.expand_more_rounded,
                                      size: 18,
                                      color: Color(0xFF0B74FA),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          PremiumDateStrip(
                            days: _stripDays,
                            selected: _selectedDate,
                            onSelect: (d) {
                              setState(() => _selectedDate = d);
                              _load();
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (!_loading && visible.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    FadeSlideIn(
                      delay: const Duration(milliseconds: 60),
                      child: DayOrbitRing(
                        selectedIndex: safeOrbit,
                        onSelect: (i) => setState(() => _orbitIndex = i),
                        appointments: [
                          for (final a in visible)
                            (
                              label: a.patient,
                              time: a.time,
                              color: _accentFor(a),
                              done: a.status == 'Completed',
                            ),
                        ],
                      ),
                    ),
                  ],
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
          else if (showEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: ScheduleEmptyState(
                error: _error,
                title: _filter.isActive
                    ? 'No matches for these filters'
                    : 'Your day looks clear',
                subtitle: _filter.isActive
                    ? 'Loosen filters or clear them to see everyone.'
                    : 'Enjoy the calm — new appointments will appear here.',
                actionLabel: _filter.isActive ? 'Clear filters' : null,
                onAction: _filter.isActive
                    ? () =>
                        setState(() => _filter = AdvancedScheduleFilter.empty)
                    : null,
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, i) {
                    final apt = visible[i];
                    final current = i == safeOrbit;
                    return AnimatedAppointmentTile(
                      index: i,
                      child: _PremiumTimelineCard(
                        appointment: apt,
                        accent: _accentFor(apt),
                        isCurrent: current,
                        isCompleted: apt.status == 'Completed',
                        onTapHighlight: () => setState(() => _orbitIndex = i),
                        onComplete: () =>
                            _showCompleteVisitDialog(context, apt),
                        onReschedule: () => _reschedule(apt),
                        onMarkArrived: () => _markArrived(apt),
                      ),
                    );
                  },
                  childCount: visible.length,
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar:
          buildBottomNav(_navIndex, (i) => switchMainTab(context, _navIndex, i)),
    );
  }

  void _showCompleteVisitDialog(BuildContext context, Appointment apt) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => CompleteVisitSheet(
        appointmentTime: apt.time,
        patient: apt.patient,
        onCompleted: (notes) => _markCompleted(apt, notes),
      ),
    );
  }
}

class _PremiumTimelineCard extends StatelessWidget {
  const _PremiumTimelineCard({
    required this.appointment,
    required this.accent,
    required this.isCurrent,
    required this.isCompleted,
    required this.onTapHighlight,
    required this.onComplete,
    required this.onReschedule,
    this.onMarkArrived,
  });

  final Appointment appointment;
  final Color accent;
  final bool isCurrent;
  final bool isCompleted;
  final VoidCallback onTapHighlight;
  final VoidCallback onComplete;
  final VoidCallback onReschedule;
  final VoidCallback? onMarkArrived;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              width: 52,
              child: Padding(
                padding: const EdgeInsets.only(top: 22),
                child: Text(
                  appointment.time,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    color: isCurrent ? accent : const Color(0xFF929296),
                  ),
                ),
              ),
            ),
            SizedBox(
              width: 24,
              child: Column(
                children: [
                  Expanded(
                    child: Container(width: 2, color: const Color(0xFFE4E6EB)),
                  ),
                  Container(
                    width: isCurrent ? 18 : 12,
                    height: isCurrent ? 18 : 12,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isCompleted
                          ? const Color(0xFFEAF7EE)
                          : isCurrent
                              ? accent
                              : Colors.white,
                      border: Border.all(
                        color: accent,
                        width: isCurrent ? 4 : 2,
                      ),
                      boxShadow: isCurrent
                          ? [
                              BoxShadow(
                                color: accent.withValues(alpha: 0.35),
                                blurRadius: 10,
                              ),
                            ]
                          : null,
                    ),
                    child: isCompleted
                        ? Icon(Icons.check, size: 8, color: accent)
                        : null,
                  ),
                  Expanded(
                    child: Container(width: 2, color: const Color(0xFFE4E6EB)),
                  ),
                ],
              ),
            ),
            Expanded(
              child: GestureDetector(
                onTap: onTapHighlight,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 280),
                  margin: const EdgeInsets.only(left: 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: isCurrent
                        ? [
                            BoxShadow(
                              color: accent.withValues(alpha: 0.2),
                              blurRadius: 18,
                              offset: const Offset(0, 6),
                            ),
                          ]
                        : null,
                  ),
                  foregroundDecoration: isCurrent
                      ? BoxDecoration(
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: accent.withValues(alpha: 0.4),
                            width: 1.5,
                          ),
                        )
                      : null,
                  child: AppointmentCard(
                    appointment: appointment,
                    onComplete: onComplete,
                    onReschedule: onReschedule,
                    onMarkArrived: onMarkArrived,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
