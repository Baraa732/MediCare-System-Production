import 'package:cms_doctor_app/core/api/services/appointment_api_service.dart';
import 'package:cms_doctor_app/core/utils/date_format.dart';
import 'package:cms_doctor_app/features/patients/patient_record_screen.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/layout/app_shell.dart';
import '../../core/navigation/app_navigation.dart';
import 'request_leave_screen.dart';

class ShiftsScreen extends StatefulWidget {
  const ShiftsScreen({super.key});

  @override
  State<ShiftsScreen> createState() => _ShiftsScreenState();
}

class _ShiftsScreenState extends State<ShiftsScreen> {
  final int _navIndex = 2;
  late DateTime _month;
  late DateTime _selected;
  List<DoctorAppointment> _monthAppointments = [];
  List<Map<String, dynamic>> _availability = [];
  List<Map<String, dynamic>> _blocks = [];
  List<Map<String, dynamic>> _hours = [];
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
        scheduleApi.getMyBlockedTimes(),
        scheduleApi.getClinicHours().catchError((_) => <Map<String, dynamic>>[]),
      ]);
      if (!mounted) return;
      setState(() {
        _monthAppointments = results[0] as List<DoctorAppointment>;
        _availability = results[1] as List<Map<String, dynamic>>;
        _blocks = results[2] as List<Map<String, dynamic>>;
        _hours = results[3] as List<Map<String, dynamic>>;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Set<int> get _daysWithAppointments => _monthAppointments
      .where((a) =>
          a.scheduledAt.year == _month.year &&
          a.scheduledAt.month == _month.month)
      .map((a) => a.scheduledAt.day)
      .toSet();

  List<DoctorAppointment> get _dayAppointments => _monthAppointments
      .where((a) => isSameDay(a.scheduledAt, _selected))
      .toList()
    ..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));

  String get _shiftLabel {
    if (_availability.isEmpty) return 'Availability not configured';
    final weekday = _selected.weekday % 7; // 0=Sun if backend uses 0-6
    final match = _availability.where((a) {
      final day = int.tryParse(a['dayOfWeek']?.toString() ?? '') ??
          int.tryParse(a['weekday']?.toString() ?? '');
      // Backend often uses 0=Sunday or 1=Monday — try both
      return day == _selected.weekday || day == weekday;
    }).toList();
    if (match.isEmpty) return 'Day off / no shift configured';
    final a = match.first;
    final start = a['startTime']?.toString() ?? a['startsAt']?.toString() ?? '';
    final end = a['endTime']?.toString() ?? a['endsAt']?.toString() ?? '';
    if (start.isEmpty && end.isEmpty) return 'Shift scheduled';
    return '$start - $end';
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
    final dayItems = _dayAppointments;
    return Scaffold(
      backgroundColor: const Color(0xFFF2F2F2),
      body: Column(
        children: [
          buildBlueHeader(
            onNotificationTap: () => openNotifications(context),
            subtitle: 'Shifts & leave',
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        if (_error != null)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Text(_error!,
                                style: const TextStyle(color: Colors.red)),
                          ),
                        GestureDetector(
                          onTap: () async {
                            await Navigator.push(
                              context,
                              MaterialPageRoute(
                                  builder: (_) => const RequestLeaveScreen()),
                            );
                            _load();
                          },
                          child: Container(
                            height: 48,
                            decoration: BoxDecoration(
                              color: const Color(0xFFEEF4FF),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.calendar_today_outlined,
                                    size: 18, color: Color(0xFF0B74FA)),
                                SizedBox(width: 8),
                                Text(
                                  'Request leave',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF0B74FA),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Leave & blocked time',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF1A1B1E),
                                ),
                              ),
                              const SizedBox(height: 8),
                              if (_blocks.isEmpty)
                                const Text(
                                  'No leave on file',
                                  style: TextStyle(color: Color(0xFF929296)),
                                )
                              else
                                ..._blocks.take(12).map((b) {
                                  final start = DateTime.tryParse(
                                          b['startsAt']?.toString() ?? '')
                                      ?.toLocal();
                                  final end = DateTime.tryParse(
                                          b['endsAt']?.toString() ?? '')
                                      ?.toLocal();
                                  final reason =
                                      b['reason']?.toString() ?? 'Leave';
                                  final status =
                                      (b['status']?.toString() ?? 'APPROVED')
                                          .toUpperCase();
                                  final statusLabel = status == 'PENDING'
                                      ? 'Pending admin'
                                      : status == 'REJECTED'
                                          ? 'Rejected'
                                          : 'Approved';
                                  return Padding(
                                    padding: const EdgeInsets.only(bottom: 8),
                                    child: Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Icon(
                                          status == 'PENDING'
                                              ? Icons.hourglass_empty
                                              : status == 'REJECTED'
                                                  ? Icons.event_busy
                                                  : Icons.event_available,
                                          size: 16,
                                          color: status == 'PENDING'
                                              ? const Color(0xFFB45309)
                                              : status == 'REJECTED'
                                                  ? const Color(0xFFB91C1C)
                                                  : const Color(0xFFE65C00),
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Text(
                                            [
                                              '$statusLabel · $reason',
                                              if (start != null)
                                                DateFormat.yMMMd()
                                                    .add_jm()
                                                    .format(start),
                                              if (end != null)
                                                '→ ${DateFormat.jm().format(end)}',
                                            ].join(' · '),
                                            style: const TextStyle(
                                              fontSize: 13,
                                              color: Color(0xFF1A1B1E),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                }),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        Container(
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
                                        fontSize: 15,
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
                                children: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                                    .map(
                                      (d) => Expanded(
                                        child: Center(
                                          child: Text(
                                            d,
                                            style: const TextStyle(
                                              fontSize: 11,
                                              color: Color(0xFF929296),
                                            ),
                                          ),
                                        ),
                                      ),
                                    )
                                    .toList(),
                              ),
                              const SizedBox(height: 4),
                              ..._buildRows(),
                              const SizedBox(height: 6),
                              const Row(
                                children: [
                                  LegendItem(
                                      color: Color(0xFF0B74FA),
                                      label: 'Has appts',
                                      isDot: true),
                                  SizedBox(width: 16),
                                  LegendItem(
                                      color: Color(0xFF0B74FA),
                                      label: 'Selected',
                                      filled: true),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Clinic hours',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF1A1B1E),
                                ),
                              ),
                              const SizedBox(height: 8),
                              if (_hours.isEmpty)
                                const Text(
                                  'Hours not published yet',
                                  style: TextStyle(color: Color(0xFF929296)),
                                )
                              else
                                ..._hours.map((h) {
                                  const days = [
                                    'Sun',
                                    'Mon',
                                    'Tue',
                                    'Wed',
                                    'Thu',
                                    'Fri',
                                    'Sat',
                                  ];
                                  final day = int.tryParse(
                                          h['dayOfWeek']?.toString() ?? '') ??
                                      0;
                                  final label = day >= 0 && day < days.length
                                      ? days[day]
                                      : 'Day $day';
                                  final closed = h['isClosed'] == true;
                                  final open = h['openTime']?.toString() ?? '';
                                  final close = h['closeTime']?.toString() ?? '';
                                  return Padding(
                                    padding: const EdgeInsets.only(bottom: 6),
                                    child: Row(
                                      children: [
                                        SizedBox(
                                          width: 40,
                                          child: Text(
                                            label,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w700,
                                              fontSize: 13,
                                            ),
                                          ),
                                        ),
                                        Text(
                                          closed
                                              ? 'Closed'
                                              : (open.isEmpty
                                                  ? 'Open'
                                                  : '$open – $close'),
                                          style: TextStyle(
                                            fontSize: 13,
                                            color: closed
                                                ? const Color(0xFF929296)
                                                : const Color(0xFF1A1B1E),
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                }),
                              if (_availability.isNotEmpty) ...[
                                const Divider(height: 20),
                                const Text(
                                  'My availability',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF1A1B1E),
                                  ),
                                ),
                                const SizedBox(height: 6),
                                ..._availability.map((a) {
                                  const days = [
                                    'Sun',
                                    'Mon',
                                    'Tue',
                                    'Wed',
                                    'Thu',
                                    'Fri',
                                    'Sat',
                                  ];
                                  final day = int.tryParse(
                                          a['dayOfWeek']?.toString() ??
                                              a['weekday']?.toString() ??
                                              '') ??
                                      0;
                                  final label = day >= 0 && day < days.length
                                      ? days[day]
                                      : 'Day $day';
                                  final start = a['startTime']?.toString() ??
                                      a['startsAt']?.toString() ??
                                      '';
                                  final end = a['endTime']?.toString() ??
                                      a['endsAt']?.toString() ??
                                      '';
                                  return Padding(
                                    padding: const EdgeInsets.only(bottom: 4),
                                    child: Text(
                                      '$label · $start – $end',
                                      style: const TextStyle(
                                        fontSize: 13,
                                        color: Color(0xFF1A1B1E),
                                      ),
                                    ),
                                  );
                                }),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            children: [
                              Text(
                                DateFormat('EEE, d MMM').format(_selected),
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF1A1B1E),
                                ),
                              ),
                              const Text(' | ',
                                  style: TextStyle(color: Color(0xFFDBDBDC))),
                              Expanded(
                                child: Text(
                                  _shiftLabel,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    color: Color(0xFF929296),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        Container(
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
                                const Text(
                                  'No appointments',
                                  style: TextStyle(color: Color(0xFF929296)),
                                )
                              else
                                ...dayItems.map((a) {
                                  final accent = a.status == 'REQUESTED'
                                      ? const Color(0xFFE65C00)
                                      : const Color(0xFF0B74FA);
                                  final bg = a.status == 'REQUESTED'
                                      ? const Color(0xFFFFF0E6)
                                      : const Color(0xFFEEF4FF);
                                  final end = a.scheduledAt.add(
                                      Duration(minutes: a.durationMinutes));
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
                                            avatarUrl: a.patientAvatarUrl,
                                            appointmentId: a.id,
                                            appointmentTime: a.timeLabel,
                                            appointmentDuration: a.durationLabel,
                                            appointmentStatus:
                                                a.uiStatus ?? a.status,
                                            appointmentReason: a.reason,
                                            appointmentNotes: a.notes,
                                            appointmentStoredNotes: a.storedNotes,
                                            isGuestPatient: a.isGuestPatient,
                                            guestPhone: a.patientPhone ??
                                                a.guestPatientPhone,
                                          ),
                                        ),
                                      ),
                                      child: Container(
                                        decoration: BoxDecoration(
                                          color: bg,
                                          borderRadius:
                                              BorderRadius.circular(8),
                                        ),
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 10, vertical: 8),
                                        child: Row(
                                          children: [
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    a.displayPatient,
                                                    style: TextStyle(
                                                      fontSize: 13,
                                                      fontWeight:
                                                          FontWeight.w600,
                                                      color: accent,
                                                    ),
                                                  ),
                                                  Text(
                                                    '${DateFormat.jm().format(a.scheduledAt)} - ${DateFormat.jm().format(end)}',
                                                    style: TextStyle(
                                                      fontSize: 12,
                                                      color: accent.withValues(
                                                          alpha: 0.7),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            Text(
                                              a.reason?.trim().isNotEmpty ==
                                                      true
                                                  ? a.reason!.trim()
                                                  : (a.uiStatus ?? 'Pending'),
                                              style: TextStyle(
                                                  fontSize: 13, color: accent),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  );
                                }),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
      bottomNavigationBar:
          buildBottomNav(_navIndex, (i) => switchMainTab(context, _navIndex, i)),
    );
  }

  List<Widget> _buildRows() {
    final firstWeekday = DateTime(_month.year, _month.month, 1).weekday % 7;
    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final cells = <int?>[
      ...List.filled(firstWeekday, null),
      ...List.generate(daysInMonth, (i) => i + 1),
    ];
    while (cells.length % 7 != 0) {
      cells.add(null);
    }
    final dots = _daysWithAppointments;
    return List.generate(cells.length ~/ 7, (row) {
      final slice = cells.sublist(row * 7, row * 7 + 7);
      return Row(
        children: slice.map((n) {
          final isSelected = n != null &&
              _selected.day == n &&
              _selected.month == _month.month &&
              _selected.year == _month.year;
          final isDot = n != null && dots.contains(n);
          return Expanded(
            child: GestureDetector(
              onTap: n == null
                  ? null
                  : () => setState(() {
                        _selected = DateTime(_month.year, _month.month, n);
                      }),
              child: Container(
                height: 34,
                margin: const EdgeInsets.all(1),
                decoration: BoxDecoration(
                  color: isSelected
                      ? const Color(0xFF0B74FA)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: n == null
                    ? const SizedBox()
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            '$n',
                            style: TextStyle(
                              fontSize: 12,
                              color: isSelected
                                  ? Colors.white
                                  : const Color(0xFF1A1B1E),
                            ),
                          ),
                          if (isDot)
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

class LegendItem extends StatelessWidget {
  const LegendItem({
    super.key,
    required this.color,
    required this.label,
    this.filled = false,
    this.isDot = false,
  });

  final Color color;
  final String label;
  final bool filled;
  final bool isDot;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          isDot
              ? Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: color),
                )
              : Container(
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    color: filled ? color : Colors.transparent,
                    border: filled ? null : Border.all(color: color),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
          const SizedBox(width: 4),
          Text(label,
              style: const TextStyle(fontSize: 11, color: Color(0xFF929296))),
        ],
      );
}
