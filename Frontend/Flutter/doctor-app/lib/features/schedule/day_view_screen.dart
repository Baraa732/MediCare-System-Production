import 'package:cms_doctor_app/core/utils/date_format.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';

import '../../core/constants/app_assets.dart';
import '../../core/layout/app_shell.dart';
import '../../core/navigation/app_navigation.dart';
import 'complete_visit_sheet.dart';
import 'models/appointment.dart';

class DayViewScreen extends StatefulWidget {
  const DayViewScreen({super.key, this.showEmpty = false});
  final bool showEmpty;

  @override
  State<DayViewScreen> createState() => _DayViewScreenState();
}

class _DayViewScreenState extends State<DayViewScreen> {
  int _navIndex = 0;
  DateTime _selectedDate = DateTime.now();
  String? _statusFilter;
  List<Appointment> _appointments = [];
  bool _loading = true;
  String? _error;

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

  List<Appointment> get _visibleAppointments {
    if (_statusFilter == null) return _appointments;
    if (_statusFilter == 'Pending') {
      return _appointments.where((a) => a.status == null).toList();
    }
    return _appointments.where((a) => a.status == _statusFilter).toList();
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

  void _showFilterSheet() {
    const options = ['All', 'Completed', 'Arrived', 'Pending'];
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Filter appointments',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
              ),
            ),
            ...options.map((option) {
              final selected = option == 'All'
                  ? _statusFilter == null
                  : _statusFilter == option;
              return ListTile(
                title: Text(option),
                trailing: selected
                    ? const Icon(Icons.check, color: Color(0xFF0B74FA))
                    : null,
                onTap: () {
                  setState(() {
                    _statusFilter = option == 'All' ? null : option;
                  });
                  Navigator.pop(context);
                },
              );
            }),
          ],
        ),
      ),
    );
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

  @override
  Widget build(BuildContext context) {
    final visible = _visibleAppointments;
    final showEmpty = !_loading && (_error != null || visible.isEmpty);

    return Scaffold(
      backgroundColor: const Color(0xFFF2F2F2),
      body: Column(
        children: [
          Container(
            color: const Color(0xFF0B74FA),
            padding: EdgeInsets.only(
              top: MediaQuery.paddingOf(context).top + 12,
              left: 16,
              right: 16,
              bottom: 16,
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: Colors.white.withValues(alpha: 0.3),
                  backgroundImage: const AssetImage(AppAssets.doctorPic),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Dr. ${sessionStorage.displayName}',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                      Text(
                        '${_appointments.length} Patients today',
                        style: const TextStyle(
                            fontSize: 14, color: Color(0xFFDBDBDC)),
                      ),
                    ],
                  ),
                ),
                notificationButton(onTap: () => openNotifications(context)),
              ],
            ),
          ),
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Column(
              children: [
                Container(
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF2F2F2),
                    borderRadius: BorderRadius.circular(44),
                  ),
                  child: Row(
                    children: [
                      _buildTab('Day', 0, icon: Icons.view_list),
                      _buildTab('Week', 1, icon: Icons.grid_view),
                      _buildTab('Month', 2, icon: Icons.calendar_month_outlined),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    const Icon(Icons.calendar_today_outlined,
                        size: 22, color: Color(0xFF1A1B1E)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            formatScheduleDate(_selectedDate),
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1A1B1E),
                            ),
                          ),
                          Text(
                            '${visible.length} Patients',
                            style: const TextStyle(
                                fontSize: 14, color: Color(0xFF929296)),
                          ),
                        ],
                      ),
                    ),
                    GestureDetector(
                      onTap: _showFilterSheet,
                      child: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          border: Border.all(color: const Color(0xFFDBDBDC)),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Icon(
                          _statusFilter == null
                              ? Icons.filter_list
                              : Icons.filter_list_alt,
                          color: const Color(0xFF0B74FA),
                          size: 18,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _circleBtn(Icons.chevron_left, onTap: _goToPreviousDay),
                    Expanded(
                      child: GestureDetector(
                        onTap: _goToToday,
                        child: Container(
                          height: 40,
                          margin: const EdgeInsets.symmetric(horizontal: 8),
                          decoration: BoxDecoration(
                            border: Border.all(color: const Color(0xFFDBDBDC)),
                            borderRadius: BorderRadius.circular(44),
                          ),
                          child: Center(
                            child: Text(
                              isSameDay(_selectedDate, DateTime.now())
                                  ? 'Today'
                                  : 'Back to today',
                              style: const TextStyle(
                                  fontSize: 18, color: Color(0xFF1A1B1E)),
                            ),
                          ),
                        ),
                      ),
                    ),
                    _circleBtn(Icons.chevron_right, onTap: _goToNextDay),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: showEmpty
                        ? ListView(
                            children: [
                              SizedBox(
                                height: MediaQuery.sizeOf(context).height * 0.4,
                                child: _buildEmpty(),
                              ),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: visible.length,
                            itemBuilder: (_, i) {
                              final apt = visible[i];
                              return AppointmentCard(
                                appointment: apt,
                                onComplete: () =>
                                    _showCompleteVisitDialog(context, apt),
                                onReschedule: () => _reschedule(apt),
                                onMarkArrived: () => _markArrived(apt),
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
      bottomNavigationBar:
          buildBottomNav(_navIndex, (i) => switchMainTab(context, _navIndex, i)),
    );
  }

  Widget _buildTab(String label, int index, {required IconData icon}) {
    final active = index == 0;
    return Expanded(
      child: GestureDetector(
        onTap: () => switchScheduleTab(context, 0, index),
        child: Container(
          height: 36,
          margin: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            color: active ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(44),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon,
                  size: 14,
                  color: active
                      ? const Color(0xFF1A1B1E)
                      : const Color(0xFF929296)),
              const SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                  color: active
                      ? const Color(0xFF1A1B1E)
                      : const Color(0xFF929296),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _circleBtn(IconData icon, {VoidCallback? onTap}) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: 40,
          height: 40,
          decoration: const BoxDecoration(
              color: Color(0xFF0B74FA), shape: BoxShape.circle),
          child: Icon(icon, color: Colors.white, size: 20),
        ),
      );

  Widget _buildEmpty() => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (_error != null)
              Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.red),
                ),
              )
            else ...[
              Image.asset(AppAssets.noDayAppointments, width: 100, height: 100),
              const SizedBox(height: 16),
              Text(
                _statusFilter != null
                    ? 'No appointments match this filter'
                    : "You don't have any appointments",
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF1A1B1E),
                ),
              ),
            ],
            if (_statusFilter != null) ...[
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => setState(() => _statusFilter = null),
                child: const Text('Clear filter'),
              ),
            ],
          ],
        ),
      );

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
