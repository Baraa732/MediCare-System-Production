import 'package:cms_doctor_app/core/api/services/appointment_api_service.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';

import '../../core/layout/app_shell.dart';
import '../../core/navigation/app_navigation.dart';
import 'widgets/advanced_month_calendar.dart';
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
        slivers: AdvancedMonthCalendar.slivers(
          month: _month,
          selected: _selected,
          appointments: _appointments,
          loading: _loading,
          error: _error,
          onMonthChanged: _onMonthChanged,
          onSelectedChanged: (d) => setState(() => _selected = d),
        ),
      ),
      bottomNavigationBar:
          buildBottomNav(_navIndex, (i) => switchMainTab(context, _navIndex, i)),
    );
  }
}
