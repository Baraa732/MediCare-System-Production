import 'package:cms_doctor_app/core/api/services/emr_api_service.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/layout/app_shell.dart';
import '../../core/navigation/app_navigation.dart';
import '../../core/widgets/common_widgets.dart';

class PatientRecordScreen extends StatefulWidget {
  const PatientRecordScreen({
    super.key,
    required this.patientId,
    this.patientName,
    this.gender,
    this.age,
  });

  final String patientId;
  final String? patientName;
  final String? gender;
  final int? age;

  @override
  State<PatientRecordScreen> createState() => _PatientRecordScreenState();
}

class _PatientRecordScreenState extends State<PatientRecordScreen> {
  int _tabIndex = 0;
  static const _tabs = ['Overview', 'Visit history', 'Documents'];

  PatientEmrChart? _chart;
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
      final chart = await emrApi.getPatientEmr(widget.patientId);
      if (!mounted) return;
      setState(() {
        _chart = chart;
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

  String get _displayName {
    final fromChart = _chart?.fullName;
    if (fromChart != null && fromChart.isNotEmpty) return fromChart;
    return widget.patientName ?? 'Patient';
  }

  String get _subtitle {
    final gender = _chart?.patient['gender']?.toString() ?? widget.gender ?? '—';
    final birth = _chart?.patient['birthDate']?.toString();
    int? age = widget.age;
    if (birth != null && birth.isNotEmpty) {
      final dob = DateTime.tryParse(birth);
      if (dob != null) {
        final now = DateTime.now();
        age = now.year - dob.year;
        if (now.month < dob.month ||
            (now.month == dob.month && now.day < dob.day)) {
          age--;
        }
      }
    }
    final ageLabel = age != null ? '$age years old' : 'Age unknown';
    return '$gender | $ageLabel';
  }

  String _mapTitle(Map<String, dynamic> m, List<String> keys) {
    for (final k in keys) {
      final v = m[k]?.toString();
      if (v != null && v.trim().isNotEmpty) return v.trim();
    }
    return '—';
  }

  String _mapSubtitle(Map<String, dynamic> m, List<String> keys) {
    final parts = <String>[];
    for (final k in keys) {
      final v = m[k]?.toString();
      if (v != null && v.trim().isNotEmpty) parts.add(v.trim());
    }
    return parts.join(' · ');
  }

  String _fmtDate(dynamic raw) {
    if (raw == null) return '';
    final dt = DateTime.tryParse(raw.toString());
    if (dt == null) return raw.toString();
    return DateFormat.yMMMd().format(dt.toLocal());
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: const Color(0xFFF5F5F5),
        body: Column(
          children: [
            Container(
              color: const Color(0xFF0B74FA),
              padding: EdgeInsets.only(
                top: MediaQuery.paddingOf(context).top + 12,
                left: 16,
                right: 16,
                bottom: 0,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      GestureDetector(
                        onTap: () => Navigator.pop(context),
                        child: const Icon(Icons.arrow_back,
                            color: Colors.white, size: 22),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _displayName,
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                            Text(
                              _subtitle,
                              style: const TextStyle(
                                  fontSize: 13, color: Color(0xFFDBDBDC)),
                            ),
                          ],
                        ),
                      ),
                      notificationButton(
                          onTap: () => openNotifications(context)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: List.generate(
                      _tabs.length,
                      (i) => GestureDetector(
                        onTap: () => setState(() => _tabIndex = i),
                        child: Container(
                          margin: const EdgeInsets.only(right: 16),
                          padding: const EdgeInsets.only(bottom: 10),
                          decoration: BoxDecoration(
                            border: Border(
                              bottom: BorderSide(
                                color: _tabIndex == i
                                    ? Colors.white
                                    : Colors.transparent,
                                width: 2,
                              ),
                            ),
                          ),
                          child: Text(
                            _tabs[i],
                            style: TextStyle(
                              fontSize: 15,
                              color: _tabIndex == i
                                  ? Colors.white
                                  : Colors.white.withValues(alpha: 0.55),
                              fontWeight: _tabIndex == i
                                  ? FontWeight.w600
                                  : FontWeight.w400,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: _error != null
                            ? [
                                Text(_error!,
                                    style: const TextStyle(color: Colors.red)),
                                const SizedBox(height: 12),
                                TextButton(
                                    onPressed: _load,
                                    child: const Text('Retry')),
                                const SizedBox(height: 16),
                                ..._buildFallbackOverview(),
                              ]
                            : _buildTabContent(),
                      ),
                    ),
            ),
          ],
        ),
      );

  List<Widget> _buildFallbackOverview() => [
        Container(
          decoration: BoxDecoration(
              color: Colors.white, borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  patientAvatar(radius: 28),
                  const SizedBox(width: 12),
                  Text(
                    _displayName,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1A1B1E),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                'EMR chart unavailable. Showing appointment demographics.',
                style: const TextStyle(fontSize: 13, color: Color(0xFF929296)),
              ),
            ],
          ),
        ),
      ];

  List<Widget> _buildTabContent() {
    switch (_tabIndex) {
      case 1:
        return _buildVisitHistoryContent(showAll: true);
      case 2:
        return _buildDocumentsContent();
      default:
        return [
          ..._buildOverviewContent(),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Visit history',
                style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1A1B1E)),
              ),
              TextButton(
                onPressed: () => setState(() => _tabIndex = 1),
                child: const Text('See all',
                    style: TextStyle(fontSize: 14, color: Color(0xFF0B74FA))),
              ),
            ],
          ),
          ..._buildVisitHistoryContent(showAll: false),
          const SizedBox(height: 4),
          const Text(
            'Clinical notes',
            style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1A1B1E)),
          ),
          const SizedBox(height: 8),
          ..._buildNotesContent(),
        ];
    }
  }

  List<Widget> _buildOverviewContent() {
    final chart = _chart!;
    final birth = chart.patient['birthDate']?.toString();
    return [
      Container(
        decoration: BoxDecoration(
            color: Colors.white, borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                patientAvatar(radius: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    _displayName,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1A1B1E),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _statBox(
                  'Age',
                  widget.age != null ? '${widget.age} y' : '—',
                ),
                const SizedBox(width: 8),
                _statBox(
                  'Gender',
                  chart.patient['gender']?.toString() ?? widget.gender ?? '—',
                ),
                const SizedBox(width: 8),
                _statBox(
                  'Date of birth',
                  birth != null && birth.isNotEmpty ? _fmtDate(birth) : '—',
                ),
              ],
            ),
          ],
        ),
      ),
      if (chart.allergies.isNotEmpty) ...[
        const SizedBox(height: 12),
        _sectionCard(
          'Allergies',
          chart.allergies
              .take(5)
              .map(
                (a) => _line(
                  _mapTitle(a, ['allergen', 'name', 'substance', 'display']),
                  _mapSubtitle(a, ['severity', 'reaction', 'status']),
                  accent: const Color(0xFFE11D48),
                ),
              )
              .toList(),
        ),
      ],
      if (chart.medications.isNotEmpty) ...[
        const SizedBox(height: 12),
        _sectionCard(
          'Medications',
          chart.medications
              .take(5)
              .map(
                (m) => _line(
                  _mapTitle(m, ['name', 'medication', 'display']),
                  _mapSubtitle(m, ['dosage', 'frequency', 'status']),
                ),
              )
              .toList(),
        ),
      ],
      if (chart.conditions.isNotEmpty) ...[
        const SizedBox(height: 12),
        _sectionCard(
          'Conditions',
          chart.conditions
              .take(5)
              .map(
                (c) => _line(
                  _mapTitle(c, ['name', 'code', 'display', 'condition']),
                  _mapSubtitle(c, ['status', 'onsetDate', 'recordedDate']),
                ),
              )
              .toList(),
        ),
      ],
    ];
  }

  List<Widget> _buildVisitHistoryContent({required bool showAll}) {
    final encounters = _chart?.encounters ?? const [];
    final items = showAll ? encounters : encounters.take(3).toList();
    return [
      if (showAll)
        const Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: Text(
            'Visit history',
            style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1A1B1E)),
          ),
        ),
      if (items.isEmpty)
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 16),
          child: Text(
            'No visit history on file',
            style: TextStyle(color: Color(0xFF929296)),
          ),
        )
      else
        ...items.map(
          (e) => Container(
            margin: const EdgeInsets.only(bottom: 8),
            decoration: BoxDecoration(
                color: Colors.white, borderRadius: BorderRadius.circular(10)),
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _mapTitle(e, ['type', 'reason', 'class', 'display', 'status']),
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1A1B1E),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    if (e['periodStart'] != null || e['start'] != null)
                      _fmtDate(e['periodStart'] ?? e['start']),
                    if (e['practitioner'] != null)
                      e['practitioner'].toString(),
                    if (e['status'] != null) e['status'].toString(),
                  ].where((s) => s.isNotEmpty).join(' · '),
                  style: const TextStyle(
                      fontSize: 12, color: Color(0xFF929296)),
                ),
              ],
            ),
          ),
        ),
    ];
  }

  List<Widget> _buildNotesContent() {
    final notes = _chart?.clinicalNotes ?? const [];
    if (notes.isEmpty) {
      return [
        const Text(
          'No clinical notes on file',
          style: TextStyle(color: Color(0xFF929296)),
        ),
      ];
    }
    return notes
        .take(8)
        .map(
          (n) => Container(
            margin: const EdgeInsets.only(bottom: 8),
            decoration: BoxDecoration(
                color: Colors.white, borderRadius: BorderRadius.circular(10)),
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _mapTitle(n, ['title', 'type', 'category', 'display']),
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1A1B1E),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _mapSubtitle(n, ['text', 'content', 'summary', 'note']),
                  style: const TextStyle(
                      fontSize: 13, color: Color(0xFF1A1B1E)),
                ),
              ],
            ),
          ),
        )
        .toList();
  }

  List<Widget> _buildDocumentsContent() {
    final labs = _chart?.labResults ?? const [];
    if (labs.isEmpty) {
      return [
        const Text(
          'Documents',
          style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w600,
              color: Color(0xFF1A1B1E)),
        ),
        const SizedBox(height: 12),
        const Text(
          'No lab results / documents synced yet',
          style: TextStyle(color: Color(0xFF929296)),
        ),
      ];
    }
    return [
      const Text(
        'Documents',
        style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w600,
            color: Color(0xFF1A1B1E)),
      ),
      const SizedBox(height: 8),
      ...labs.map(
        (doc) => Container(
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
              color: Colors.white, borderRadius: BorderRadius.circular(10)),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              const Icon(Icons.insert_drive_file_outlined,
                  color: Color(0xFF929296), size: 22),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _mapTitle(doc, ['name', 'test', 'display', 'code']),
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF1A1B1E),
                      ),
                    ),
                    Text(
                      _mapSubtitle(doc, ['value', 'unit', 'status', 'date']),
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF929296)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    ];
  }

  Widget _sectionCard(String title, List<Widget> children) => Container(
        decoration: BoxDecoration(
            color: Colors.white, borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1A1B1E),
              ),
            ),
            const SizedBox(height: 8),
            ...children,
          ],
        ),
      );

  Widget _line(String title, String subtitle, {Color? accent}) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: accent ?? const Color(0xFF1A1B1E),
              ),
            ),
            if (subtitle.isNotEmpty)
              Text(
                subtitle,
                style: const TextStyle(fontSize: 12, color: Color(0xFF929296)),
              ),
          ],
        ),
      );

  Widget _statBox(String label, String value) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0xFFF5F5F5),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style:
                      const TextStyle(fontSize: 11, color: Color(0xFF929296))),
              Text(
                value,
                style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1A1B1E)),
              ),
            ],
          ),
        ),
      );
}
