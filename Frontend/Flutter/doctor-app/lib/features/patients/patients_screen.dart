import 'package:cms_doctor_app/core/api/services/appointment_api_service.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:intl/intl.dart';

import '../../core/constants/app_assets.dart';
import '../../core/layout/app_shell.dart';
import '../../core/navigation/app_navigation.dart';
import '../../core/widgets/common_widgets.dart';
import 'patient_record_screen.dart';

class _PatientItem {
  const _PatientItem({
    required this.id,
    required this.name,
    this.gender,
    this.age,
    this.phone,
    this.lastVisit,
    this.avatarUrl,
  });

  final String id;
  final String name;
  final String? gender;
  final int? age;
  final String? phone;
  final DateTime? lastVisit;
  final String? avatarUrl;
}

class PatientsScreen extends StatefulWidget {
  const PatientsScreen({super.key});

  @override
  State<PatientsScreen> createState() => _PatientsScreenState();
}

class _PatientsScreenState extends State<PatientsScreen> {
  final int _navIndex = 1;
  final _searchCtrl = TextEditingController();
  List<_PatientItem> _patients = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final now = DateTime.now();
      final list = await appointmentApi.getMySchedule(
        from: now.subtract(const Duration(days: 365)),
        to: now.add(const Duration(days: 90)),
      );
      if (!mounted) return;
      final map = <String, DoctorAppointment>{};
      for (final a in list) {
        if (a.patientId.isEmpty) continue;
        final existing = map[a.patientId];
        if (existing == null ||
            a.scheduledAt.isAfter(existing.scheduledAt)) {
          map[a.patientId] = a;
        }
      }
      final patients = map.values
          .map(
            (a) => _PatientItem(
              id: a.patientId,
              name: a.displayPatient,
              gender: a.patientGender,
              age: a.ageYears,
              phone: a.patientPhone,
              lastVisit: a.scheduledAt,
              avatarUrl: a.patientAvatarUrl,
            ),
          )
          .toList()
        ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
      setState(() {
        _patients = patients;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
        _patients = [];
      });
    }
  }

  List<_PatientItem> get _filteredPatients {
    final query = _searchCtrl.text.trim().toLowerCase();
    if (query.isEmpty) return _patients;
    return _patients
        .where((p) => p.name.toLowerCase().contains(query))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final patients = _filteredPatients;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      body: Column(
        children: [
          buildBlueHeader(
            onNotificationTap: () => openNotifications(context),
            subtitle: '${_patients.length} patients',
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        Container(
                          height: 48,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(24),
                          ),
                          child: TextField(
                            controller: _searchCtrl,
                            onChanged: (_) => setState(() {}),
                            decoration: const InputDecoration(
                              hintText: 'Search Patients...',
                              hintStyle: TextStyle(
                                  fontSize: 15, color: Color(0xFFB6B7B9)),
                              prefixIcon:
                                  Icon(Icons.search, color: Color(0xFF929296)),
                              border: InputBorder.none,
                              contentPadding:
                                  EdgeInsets.symmetric(vertical: 12),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        if (_error != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 24),
                            child: Text(
                              _error!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: Colors.red),
                            ),
                          )
                        else if (patients.isEmpty)
                          const Padding(
                            padding: EdgeInsets.only(top: 40),
                            child: Center(
                              child: Text(
                                'No patients found',
                                style: TextStyle(
                                    fontSize: 16, color: Color(0xFF929296)),
                              ),
                            ),
                          )
                        else
                          ...patients.map(
                            (patient) => Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: ListTile(
                                contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 6),
                                leading: patientAvatar(
                                  radius: 24,
                                  imageUrl: patient.avatarUrl,
                                ),
                                title: Text(
                                  patient.name,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF1A1B1E),
                                  ),
                                ),
                                subtitle: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          patient.gender ?? '—',
                                          style: const TextStyle(
                                              fontSize: 14,
                                              color: Color(0xFF929296)),
                                        ),
                                        const Padding(
                                          padding:
                                              EdgeInsets.symmetric(horizontal: 6),
                                          child: Text('|',
                                              style: TextStyle(
                                                  color: Color(0xFFDBDBDC))),
                                        ),
                                        Text(
                                          patient.age != null
                                              ? '${patient.age} years old'
                                              : 'Age unknown',
                                          style: const TextStyle(
                                              fontSize: 14,
                                              color: Color(0xFF929296)),
                                        ),
                                      ],
                                    ),
                                    if (patient.phone != null &&
                                        patient.phone!.isNotEmpty)
                                      Text(
                                        patient.phone!,
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: Color(0xFFB6B7B9),
                                        ),
                                      ),
                                    if (patient.lastVisit != null)
                                      Text(
                                        'Last visit ${DateFormat.yMMMd().format(patient.lastVisit!)}',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: Color(0xFFB6B7B9),
                                        ),
                                      ),
                                  ],
                                ),
                                trailing: SvgPicture.asset(
                                  AppAssets.heartbeat,
                                  width: 24,
                                  height: 24,
                                  colorFilter: const ColorFilter.mode(
                                    Color(0xFF929296),
                                    BlendMode.srcIn,
                                  ),
                                ),
                                onTap: () => Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => PatientRecordScreen(
                                      patientId: patient.id,
                                      patientName: patient.name,
                                      gender: patient.gender,
                                      age: patient.age,
                                      avatarUrl: patient.avatarUrl,
                                    ),
                                  ),
                                ),
                              ),
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
}
