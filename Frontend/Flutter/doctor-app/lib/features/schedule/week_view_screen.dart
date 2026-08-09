import 'package:cms_doctor_app/core/api/services/appointment_api_service.dart';
import 'package:cms_doctor_app/core/utils/date_format.dart';
import 'package:cms_doctor_app/features/patients/patient_record_screen.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/layout/app_shell.dart';
import '../../core/navigation/app_navigation.dart';

class WeekViewScreen extends StatefulWidget {
  const WeekViewScreen({super.key});

  @override
  State<WeekViewScreen> createState() => _WeekViewScreenState();
}

class _WeekViewScreenState extends State<WeekViewScreen> {
  int _navIndex = 0;
  late DateTime _weekStart;
  List<DoctorAppointment> _appointments = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _weekStart = DateTime(now.year, now.month, now.day)
        .subtract(Duration(days: now.weekday - 1));
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final from = _weekStart;
      final to = _weekStart.add(const Duration(days: 7));
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
    setState(() => _weekStart = _weekStart.add(Duration(days: 7 * delta)));
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF2F2F2),
      body: Column(
        children: [
          buildBlueHeader(
            onNotificationTap: () => openNotifications(context),
            subtitle: '${_appointments.length} this week',
          ),
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Column(
              children: [
                buildTabs(activeTab: 1, context: context),
                const SizedBox(height: 12),
                Row(
                  children: [
                    IconButton(
                      onPressed: () => _shiftWeek(-1),
                      icon: const Icon(Icons.chevron_left),
                    ),
                    Expanded(
                      child: Text(
                        '${DateFormat.MMMd().format(_weekStart)} – ${DateFormat.MMMd().format(_weekStart.add(const Duration(days: 6)))}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1A1B1E),
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () => _shiftWeek(1),
                      icon: const Icon(Icons.chevron_right),
                    ),
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
                    child: _error != null
                        ? ListView(
                            children: [
                              Padding(
                                padding: const EdgeInsets.all(24),
                                child: Text(_error!,
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(color: Colors.red)),
                              ),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: 7,
                            itemBuilder: (_, i) {
                              final day = _weekStart.add(Duration(days: i));
                              final items = _forDay(day);
                              return _dayGroup(day, items);
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

  Widget _dayGroup(DateTime day, List<DoctorAppointment> items) {
    final today = isSameDay(day, DateTime.now());
    final label = DateFormat('EEE, d MMM').format(day);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF1A1B1E),
                ),
              ),
              if (today) ...[
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE6F4EA),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text(
                    'Today',
                    style: TextStyle(fontSize: 11, color: Color(0xFF2E7D32)),
                  ),
                ),
              ],
              const Spacer(),
              Text(
                '${items.length} appt',
                style: const TextStyle(fontSize: 13, color: Color(0xFF929296)),
              ),
            ],
          ),
          if (items.isEmpty)
            const Divider(color: Color(0xFFDBDBDC))
          else
            ...items.map((a) {
              final accent = a.status == 'REQUESTED'
                  ? const Color(0xFFE65C00)
                  : const Color(0xFF0B74FA);
              final bg = a.status == 'REQUESTED'
                  ? const Color(0xFFFFF0E6)
                  : const Color(0xFFEEF4FF);
              final end = a.scheduledAt.add(Duration(minutes: a.durationMinutes));
              return Padding(
                padding: const EdgeInsets.only(top: 8),
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
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 8),
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
            }),
        ],
      ),
    );
  }
}
