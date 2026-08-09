import 'package:cms_doctor_app/core/api/services/appointment_api_service.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/navigation/app_navigation.dart';
import '../../core/widgets/common_widgets.dart';
import 'request_done_screen.dart';

class RequestLeaveScreen extends StatefulWidget {
  const RequestLeaveScreen({super.key});

  @override
  State<RequestLeaveScreen> createState() => _RequestLeaveScreenState();
}

class _RequestLeaveScreenState extends State<RequestLeaveScreen> {
  DateTime _startDate = DateTime.now().add(const Duration(days: 1));
  DateTime _endDate = DateTime.now().add(const Duration(days: 1));
  bool _allDay = true;
  bool _showAppointments = false;
  bool _submitting = false;
  final _reasonCtrl = TextEditingController();
  String? _leaveType;
  TimeOfDay _fromTime = const TimeOfDay(hour: 9, minute: 0);
  TimeOfDay _toTime = const TimeOfDay(hour: 17, minute: 0);
  List<DoctorAppointment> _conflicts = [];

  static const _leaveTypes = [
    'Annual leave',
    'Sick leave',
    'Emergency leave',
    'Unpaid leave',
  ];

  @override
  void initState() {
    super.initState();
    _loadConflicts();
  }

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  DateTime get _startsAt {
    if (_allDay) {
      return DateTime(_startDate.year, _startDate.month, _startDate.day);
    }
    return DateTime(
      _startDate.year,
      _startDate.month,
      _startDate.day,
      _fromTime.hour,
      _fromTime.minute,
    );
  }

  DateTime get _endsAt {
    if (_allDay) {
      return DateTime(_endDate.year, _endDate.month, _endDate.day, 23, 59);
    }
    return DateTime(
      _endDate.year,
      _endDate.month,
      _endDate.day,
      _toTime.hour,
      _toTime.minute,
    );
  }

  Future<void> _loadConflicts() async {
    try {
      final list = await appointmentApi.getMySchedule(
        from: _startsAt,
        to: _endsAt.add(const Duration(minutes: 1)),
      );
      if (!mounted) return;
      setState(() {
        _conflicts = list
            .where((a) =>
                a.status != 'CANCELLED' &&
                a.status != 'COMPLETED' &&
                a.status != 'NO_SHOW')
            .toList();
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _conflicts = []);
    }
  }

  String _formatTime(TimeOfDay time) {
    final hour = time.hourOfPeriod == 0 ? 12 : time.hourOfPeriod;
    final minute = time.minute.toString().padLeft(2, '0');
    final period = time.period == DayPeriod.am ? 'AM' : 'PM';
    return '$hour:$minute $period';
  }

  Future<void> _pickDate({required bool isStart}) async {
    final initial = isStart ? _startDate : _endDate;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _startDate = picked;
        if (_endDate.isBefore(_startDate)) _endDate = _startDate;
      } else {
        _endDate = picked;
        if (_endDate.isBefore(_startDate)) _startDate = _endDate;
      }
    });
    _loadConflicts();
  }

  Future<void> _pickTime({required bool isFrom}) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: isFrom ? _fromTime : _toTime,
    );
    if (picked != null) {
      setState(() {
        if (isFrom) {
          _fromTime = picked;
        } else {
          _toTime = picked;
        }
      });
      _loadConflicts();
    }
  }

  Future<void> _pickLeaveType() async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: _leaveTypes
              .map(
                (type) => ListTile(
                  title: Text(type),
                  trailing: _leaveType == type
                      ? const Icon(Icons.check, color: Color(0xFF0B74FA))
                      : null,
                  onTap: () => Navigator.pop(context, type),
                ),
              )
              .toList(),
        ),
      ),
    );
    if (picked != null) setState(() => _leaveType = picked);
  }

  Future<void> _submit() async {
    if (_leaveType == null) {
      showSnack(context, 'Select a leave type');
      return;
    }
    if (_reasonCtrl.text.trim().isEmpty) {
      showSnack(context, 'Please provide a reason for your leave');
      return;
    }
    if (_endsAt.isBefore(_startsAt) || _endsAt.isAtSameMomentAs(_startsAt)) {
      showSnack(context, 'End must be after start');
      return;
    }
    setState(() => _submitting = true);
    try {
      await scheduleApi.requestLeave(
        startsAt: _startsAt,
        endsAt: _endsAt,
        reason: '$_leaveType: ${_reasonCtrl.text.trim()}',
      );
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const RequestDoneScreen()),
      );
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Column(
            children: [
              Container(
                color: const Color(0xFF0B74FA),
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                child: Row(
                  children: [
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: const Icon(Icons.arrow_back, color: Colors.white),
                    ),
                    const SizedBox(width: 12),
                    const Text(
                      'Request leave',
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                          color: Colors.white),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Select dates',
                        style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF1A1B1E)),
                      ),
                      const SizedBox(height: 12),
                      _dateRow(
                        'From',
                        DateFormat.yMMMd().format(_startDate),
                        () => _pickDate(isStart: true),
                      ),
                      const SizedBox(height: 8),
                      _dateRow(
                        'To',
                        DateFormat.yMMMd().format(_endDate),
                        () => _pickDate(isStart: false),
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'Select time',
                        style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF1A1B1E)),
                      ),
                      const SizedBox(height: 12),
                      _buildTimeRow('From:', _formatTime(_fromTime),
                          onTap: () => _pickTime(isFrom: true)),
                      const SizedBox(height: 8),
                      _buildTimeRow('To:', _formatTime(_toTime),
                          onTap: () => _pickTime(isFrom: false)),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          const Text(
                            'All day leave',
                            style: TextStyle(
                                fontSize: 15, color: Color(0xFF1A1B1E)),
                          ),
                          const Spacer(),
                          Switch(
                            value: _allDay,
                            onChanged: (v) {
                              setState(() => _allDay = v);
                              _loadConflicts();
                            },
                            activeTrackColor: const Color(0xFF0B74FA),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Leave type',
                        style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF1A1B1E)),
                      ),
                      const SizedBox(height: 8),
                      GestureDetector(
                        onTap: _pickLeaveType,
                        child: Container(
                          height: 50,
                          decoration: BoxDecoration(
                            border: Border.all(color: const Color(0xFFDBDBDC)),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  _leaveType ?? 'Select a leave type',
                                  style: TextStyle(
                                    fontSize: 15,
                                    color: _leaveType == null
                                        ? const Color(0xFFB6B7B9)
                                        : const Color(0xFF1A1B1E),
                                  ),
                                ),
                              ),
                              const Icon(Icons.keyboard_arrow_down,
                                  color: Color(0xFF1A1B1E)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Reason to leave',
                            style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF1A1B1E)),
                          ),
                          ListenableBuilder(
                            listenable: _reasonCtrl,
                            builder: (_, __) => Text(
                              '${_reasonCtrl.text.length}/200',
                              style: const TextStyle(
                                  fontSize: 13, color: Color(0xFF929296)),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _reasonCtrl,
                        maxLines: 5,
                        maxLength: 200,
                        decoration: InputDecoration(
                          hintText: 'Reason...',
                          hintStyle:
                              const TextStyle(color: Color(0xFFB6B7B9)),
                          counterText: '',
                          border: inputBorder(const Color(0xFFDBDBDC)),
                          enabledBorder: inputBorder(const Color(0xFFDBDBDC)),
                          focusedBorder:
                              inputBorder(const Color(0xFF0B74FA), width: 2),
                        ),
                      ),
                      const SizedBox(height: 16),
                      GestureDetector(
                        onTap: () => setState(
                            () => _showAppointments = !_showAppointments),
                        child: Container(
                          height: 50,
                          decoration: BoxDecoration(
                            border: Border.all(color: const Color(0xFFDBDBDC)),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  '${_conflicts.length} Confirmed appointments in this period',
                                  style: const TextStyle(
                                      fontSize: 14, color: Color(0xFF1A1B1E)),
                                ),
                              ),
                              Icon(
                                _showAppointments
                                    ? Icons.keyboard_arrow_up
                                    : Icons.keyboard_arrow_down,
                                color: const Color(0xFF1A1B1E),
                              ),
                            ],
                          ),
                        ),
                      ),
                      if (_showAppointments) ...[
                        const SizedBox(height: 8),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF5F5F5),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: _conflicts.isEmpty
                              ? const Text('No conflicting appointments')
                              : Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: _conflicts
                                      .map(
                                        (a) => Padding(
                                          padding:
                                              const EdgeInsets.only(bottom: 6),
                                          child: Text(
                                            '${DateFormat('EEE, d MMM').format(a.scheduledAt)} — ${a.displayPatient} — ${DateFormat.jm().format(a.scheduledAt)}',
                                          ),
                                        ),
                                      )
                                      .toList(),
                                ),
                        ),
                      ],
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEEF4FF),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.info_outline,
                                size: 18, color: Color(0xFF0B74FA)),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Your leave blocks your calendar. The secretary can help rebook any conflicting visits.',
                                style: TextStyle(
                                    fontSize: 13,
                                    color: Color(0xFF0B74FA),
                                    height: 1.5),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: _submitting ? null : _submit,
                          icon: _submitting
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: Colors.white),
                                )
                              : const Icon(Icons.calendar_today_outlined,
                                  size: 18),
                          label: Text(
                            _submitting ? 'Submitting...' : 'Submit request',
                            style: const TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w600),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0B74FA),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8)),
                            elevation: 0,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      );

  Widget _dateRow(String label, String value, VoidCallback onTap) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          height: 50,
          decoration: BoxDecoration(
            border: Border.all(color: const Color(0xFFDBDBDC)),
            borderRadius: BorderRadius.circular(8),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Row(
            children: [
              Text(label,
                  style:
                      const TextStyle(fontSize: 15, color: Color(0xFF929296))),
              const Spacer(),
              Text(value,
                  style:
                      const TextStyle(fontSize: 15, color: Color(0xFF1A1B1E))),
              const SizedBox(width: 8),
              const Icon(Icons.calendar_today_outlined,
                  size: 18, color: Color(0xFF0B74FA)),
            ],
          ),
        ),
      );

  Widget _buildTimeRow(String label, String time,
          {required VoidCallback onTap}) =>
      Container(
        decoration: const BoxDecoration(
          border: Border(left: BorderSide(color: Color(0xFF0B74FA), width: 3)),
        ),
        padding: const EdgeInsets.only(left: 12),
        child: Row(
          children: [
            Text(label,
                style:
                    const TextStyle(fontSize: 15, color: Color(0xFF1A1B1E))),
            const Spacer(),
            GestureDetector(
              onTap: _allDay ? null : onTap,
              child: Container(
                height: 44,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  border: Border.all(color: const Color(0xFFDBDBDC)),
                  borderRadius: BorderRadius.circular(8),
                  color: _allDay ? const Color(0xFFF5F5F5) : Colors.white,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.access_time,
                        size: 18, color: Color(0xFF929296)),
                    const SizedBox(width: 6),
                    Text(
                      _allDay ? 'All day' : time,
                      style: TextStyle(
                        fontSize: 14,
                        color: _allDay
                            ? const Color(0xFF929296)
                            : const Color(0xFF1A1B1E),
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Icon(Icons.keyboard_arrow_down,
                        size: 18, color: Color(0xFF1A1B1E)),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
}
