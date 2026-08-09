import 'package:cms_doctor_app/core/api/services/appointment_api_service.dart';
import 'package:cms_doctor_app/core/utils/date_format.dart';
import 'package:cms_doctor_app/features/patients/patient_record_screen.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/layout/app_shell.dart';
import '../../core/navigation/app_navigation.dart';

class MonthViewScreen extends StatefulWidget {
  const MonthViewScreen({super.key});

  @override
  State<MonthViewScreen> createState() => _MonthViewScreenState();
}

class _MonthViewScreenState extends State<MonthViewScreen> {
  static const _days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  int _navIndex = 0;
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
        .where((a) => isSameDay(a.scheduledAt, _selected))
        .toList()
      ..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));
  }

  void _shiftMonth(int delta) {
    setState(() {
      _month = DateTime(_month.year, _month.month + delta);
      _selected = DateTime(_month.year, _month.month, 1);
    });
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final dayItems = _selectedDayAppointments;
    return Scaffold(
      backgroundColor: const Color(0xFFF2F2F2),
      body: Column(
        children: [
          buildBlueHeader(
            onNotificationTap: () => openNotifications(context),
            subtitle: '${_appointments.length} this month',
          ),
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: buildTabs(activeTab: 2, context: context),
          ),
          Container(
            margin: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
            ),
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                Row(
                  children: [
                    IconButton(
                      onPressed: () => _shiftMonth(-1),
                      icon: const Icon(Icons.chevron_left),
                    ),
                    Expanded(
                      child: Text(
                        DateFormat.yMMMM().format(_month),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1A1B1E),
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () => _shiftMonth(1),
                      icon: const Icon(Icons.chevron_right),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: _days
                      .map(
                        (d) => Expanded(
                          child: Center(
                            child: Text(
                              d,
                              style: const TextStyle(
                                fontSize: 12,
                                color: Color(0xFF929296),
                              ),
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 8),
                ..._buildCalendarRows(),
              ],
            ),
          ),
          Expanded(
            child: Container(
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              padding: const EdgeInsets.all(12),
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                      ? Center(
                          child: Text(_error!,
                              style: const TextStyle(color: Colors.red)))
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView(
                            children: [
                              Row(
                                children: [
                                  Text(
                                    DateFormat('EEE, d MMM').format(_selected),
                                    style: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF1A1B1E),
                                    ),
                                  ),
                                  const Spacer(),
                                  Text(
                                    '${dayItems.length} appt',
                                    style: const TextStyle(
                                      fontSize: 13,
                                      color: Color(0xFF929296),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              if (dayItems.isEmpty)
                                const Padding(
                                  padding: EdgeInsets.only(top: 24),
                                  child: Center(
                                    child: Text(
                                      'No appointments this day',
                                      style: TextStyle(
                                        color: Color(0xFF929296),
                                      ),
                                    ),
                                  ),
                                )
                              else
                                ...dayItems.map(_apptTile),
                            ],
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

  Widget _apptTile(DoctorAppointment a) {
    final accent = a.status == 'REQUESTED'
        ? const Color(0xFFE65C00)
        : const Color(0xFF0B74FA);
    final bg = a.status == 'REQUESTED'
        ? const Color(0xFFFFF0E6)
        : const Color(0xFFEEF4FF);
    final end = a.scheduledAt.add(Duration(minutes: a.durationMinutes));
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => PatientRecordScreen(
              patientId: a.patientId,
              patientName: a.displayPatient,
              gender: a.patientGender,
              age: a.ageYears,
            ),
          ),
        ),
        borderRadius: BorderRadius.circular(8),
        child: Container(
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(8),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      a.displayPatient,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: accent,
                      ),
                    ),
                    Text(
                      '${DateFormat.jm().format(a.scheduledAt)} - ${DateFormat.jm().format(end)}',
                      style: TextStyle(
                        fontSize: 12,
                        color: accent.withValues(alpha: 0.7),
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                a.reason?.trim().isNotEmpty == true
                    ? a.reason!.trim()
                    : (a.uiStatus ?? 'Pending'),
                style: TextStyle(fontSize: 13, color: accent),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _buildCalendarRows() {
    final firstWeekday = DateTime(_month.year, _month.month, 1).weekday % 7;
    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final cells = <int?>[
      ...List.filled(firstWeekday, null),
      ...List.generate(daysInMonth, (i) => i + 1),
    ];
    while (cells.length % 7 != 0) {
      cells.add(null);
    }
    final withDots = _daysWithAppointments;
    return List.generate(cells.length ~/ 7, (row) {
      final slice = cells.sublist(row * 7, row * 7 + 7);
      return Row(
        children: slice.map((n) {
          final isSelected = n != null &&
              _selected.day == n &&
              _selected.month == _month.month &&
              _selected.year == _month.year;
          final hasDot = n != null && withDots.contains(n);
          return Expanded(
            child: GestureDetector(
              onTap: n == null
                  ? null
                  : () => setState(() {
                        _selected =
                            DateTime(_month.year, _month.month, n);
                      }),
              child: Container(
                height: 36,
                margin: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  color: isSelected
                      ? const Color(0xFF0B74FA)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: n == null
                    ? const SizedBox()
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            '$n',
                            style: TextStyle(
                              fontSize: 13,
                              color: isSelected
                                  ? Colors.white
                                  : const Color(0xFF1A1B1E),
                            ),
                          ),
                          if (hasDot)
                            Container(
                              width: 4,
                              height: 4,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isSelected
                                    ? Colors.white
                                    : const Color(0xFF0B74FA),
                              ),
                            ),
                        ],
                      ),
              ),
            ),
          );
        }).toList(),
      );
    });
  }
}
