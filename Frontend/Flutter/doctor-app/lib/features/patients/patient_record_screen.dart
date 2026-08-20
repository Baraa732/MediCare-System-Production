import 'package:cms_doctor_app/core/api/services/appointment_api_service.dart';
import 'package:cms_doctor_app/core/api/services/emr_api_service.dart';
import 'package:cms_doctor_app/features/schedule/visit_actions.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:intl/intl.dart';

import '../../core/constants/app_assets.dart';
import '../../core/layout/app_shell.dart';
import '../../core/navigation/app_navigation.dart';
import '../../core/widgets/common_widgets.dart';
import 'generate_visit_report_sheet.dart';
import 'emr_write_sheets.dart';

class PatientRecordScreen extends StatefulWidget {
  const PatientRecordScreen({
    super.key,
    required this.patientId,
    this.patientName,
    this.gender,
    this.age,
    this.appointmentId,
    this.appointmentTime,
    this.appointmentStatus,
    this.appointmentReason,
    this.appointmentNotes,
    this.appointmentDuration,
  });

  final String patientId;
  final String? patientName;
  final String? gender;
  final int? age;
  final String? appointmentId;
  final String? appointmentTime;
  final String? appointmentStatus;
  final String? appointmentReason;
  final String? appointmentNotes;
  final String? appointmentDuration;

  @override
  State<PatientRecordScreen> createState() => _PatientRecordScreenState();
}

class _PatientRecordScreenState extends State<PatientRecordScreen>
    with SingleTickerProviderStateMixin {
  int _tabIndex = 0;
  static const _tabs = ['Overview', 'Visit history', 'Documents'];

  PatientEmrChart? _chart;
  List<DoctorAppointment> _visits = [];
  bool _loading = true;
  bool _emrMissing = false;
  String? _error;
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);
    _load();
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _emrMissing = false;
    });
    try {
      var chart = await _tryFetchChart();
      if (chart == null) {
        // Auto-link OpenEMR chart for this clinic patient, then reload.
        try {
          await emrApi.ensurePatientEmr(
            widget.patientId,
            profileHint: {
              if (widget.patientName != null) 'firstName': widget.patientName,
              if (widget.gender != null) 'gender': widget.gender,
            },
          );
          chart = await _tryFetchChart();
        } catch (_) {}
      }

      List<DoctorAppointment> visits = const [];
      try {
        visits = await appointmentApi.getForPatient(widget.patientId);
      } catch (_) {}

      if (!mounted) return;
      if (chart != null) {
        setState(() {
          _chart = chart;
          _visits = visits;
          _loading = false;
          _emrMissing = false;
        });
        return;
      }

      // Fallback workspace so doctors can still review + write notes.
      setState(() {
        _chart = _syntheticChart();
        _visits = visits;
        _loading = false;
        _emrMissing = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _emrMissing = true;
        _error = e.toString();
        _chart = _syntheticChart();
      });
    }
  }

  Future<PatientEmrChart?> _tryFetchChart() async {
    try {
      return await emrApi.getPatientEmr(widget.patientId);
    } catch (e) {
      final msg = e.toString().toLowerCase();
      final missing = msg.contains('no emr record') ||
          msg.contains('not available yet') ||
          msg.contains('not found') ||
          msg.contains('404');
      if (missing) return null;
      rethrow;
    }
  }

  PatientEmrChart _syntheticChart() {
    final parts = (widget.patientName ?? 'Patient').trim().split(RegExp(r'\s+'));
    final first = parts.isNotEmpty ? parts.first : 'Patient';
    final last = parts.length > 1 ? parts.sublist(1).join(' ') : '';
    final notes = <Map<String, dynamic>>[];
    if (widget.appointmentNotes != null &&
        widget.appointmentNotes!.trim().isNotEmpty) {
      notes.add({
        'type': 'Visit report',
        'content': widget.appointmentNotes,
        'title': 'Latest visit notes',
      });
    }
    final encounters = <Map<String, dynamic>>[];
    if (_hasAppointmentContext) {
      encounters.add({
        'type': widget.appointmentReason ?? 'Clinic visit',
        'status': widget.appointmentStatus ?? 'scheduled',
        'periodStart': widget.appointmentTime,
        'reason': widget.appointmentReason,
      });
    }
    return PatientEmrChart(
      patient: {
        'firstName': first,
        'lastName': last,
        'gender': widget.gender,
        'birthDate': null,
      },
      allergies: const [],
      medications: const [],
      conditions: const [],
      problems: const [],
      encounters: encounters,
      vitalSigns: const [],
      labResults: const [],
      immunizations: const [],
      carePlans: const [],
      clinicalNotes: notes,
      documents: const [],
    );
  }

  Future<void> _writeClinicalNote() async {
    final contentCtrl = TextEditingController();
    final typeCtrl = TextEditingController(text: 'Visit note');
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            bottom: MediaQuery.viewInsetsOf(ctx).bottom + 16,
            top: 12,
          ),
          child: Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Write on EMR',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF1A1B1E),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _displayName,
                    style: const TextStyle(
                        fontSize: 13, color: Color(0xFF929296)),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: typeCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Note type',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: contentCtrl,
                    maxLines: 6,
                    decoration: const InputDecoration(
                      labelText: 'Clinical note',
                      alignLabelWithHint: true,
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () {
                        if (contentCtrl.text.trim().isEmpty) return;
                        Navigator.pop(ctx, true);
                      },
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF0B74FA),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: const Text('Save to EMR'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );

    final content = contentCtrl.text.trim();
    final type = typeCtrl.text.trim();
    contentCtrl.dispose();
    typeCtrl.dispose();
    if (saved != true || content.isEmpty || !mounted) return;

    try {
      await emrApi.addClinicalNote(
        widget.patientId,
        content: content,
        type: type.isEmpty ? 'Visit note' : type,
      );
      // Also mirror onto appointment notes when available.
      if (widget.appointmentId != null && widget.appointmentId!.isNotEmpty) {
        try {
          await appointmentApi.updateNotes(widget.appointmentId!, content);
        } catch (_) {}
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Clinical note saved to EMR')),
      );
      await _load();
    } catch (e) {
      // Fallback: keep doctor productive via appointment notes.
      try {
        if (widget.appointmentId != null && widget.appointmentId!.isNotEmpty) {
          await appointmentApi.updateNotes(widget.appointmentId!, content);
        }
        if (!mounted) return;
        setState(() {
          final existing = _chart?.clinicalNotes ?? const [];
          _chart = (_chart ?? _syntheticChart()).copyWith(
            clinicalNotes: [
              {
                'type': type.isEmpty ? 'Visit note' : type,
                'content': content,
                'title': type.isEmpty ? 'Visit note' : type,
              },
              ...existing,
            ],
          );
          _emrMissing = true;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Saved locally on visit notes. EMR link will sync when available.',
            ),
          ),
        );
      } catch (inner) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not save note: $inner')),
        );
      }
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

  bool get _hasAppointmentContext =>
      (widget.appointmentId != null && widget.appointmentId!.isNotEmpty) ||
      (widget.appointmentTime != null && widget.appointmentTime!.isNotEmpty);

  bool get _canActOnAppointment {
    final id = widget.appointmentId;
    if (id == null || id.isEmpty) return false;
    final status = widget.appointmentStatus;
    return status != 'Completed' &&
        status != 'Cancelled' &&
        status != 'No show' &&
        status != 'COMPLETED' &&
        status != 'CANCELLED' &&
        status != 'NO_SHOW';
  }

  Future<void> _openGenerateReport() async {
    HapticFeedback.selectionClick();
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => GenerateVisitReportSheet(
        patientId: widget.patientId,
        patientName: _displayName,
        appointmentId: widget.appointmentId,
        appointmentLabel: [
          if (widget.appointmentTime != null) widget.appointmentTime!,
          if (widget.appointmentStatus != null) widget.appointmentStatus!,
        ].join(' · '),
      ),
    );
    if (saved == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Visit report saved')),
      );
      _load();
    }
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
        backgroundColor: const Color(0xFFF2F2F2),
        floatingActionButton: _HeartbeatReportFab(
          pulse: _pulse,
          onTap: _openGenerateReport,
        ),
        body: Column(
          children: [
            Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF0B74FA), Color(0xFF0A66DE)],
                ),
              ),
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
                                fontWeight: FontWeight.w700,
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
                      _GrayHeartbeatButton(
                        pulse: _pulse,
                        onTap: _openGenerateReport,
                        onHeader: true,
                      ),
                      const SizedBox(width: 8),
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
                  ? const Center(
                      child: CircularProgressIndicator(color: Color(0xFF0B74FA)),
                    )
                  : RefreshIndicator(
                      color: const Color(0xFF0B74FA),
                      onRefresh: _load,
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                        children: [
                          if (_error != null) ...[
                            Text(_error!,
                                style: const TextStyle(color: Colors.red)),
                            TextButton(
                                onPressed: _load, child: const Text('Retry')),
                            const SizedBox(height: 12),
                          ],
                          if (_hasAppointmentContext) ...[
                            _appointmentDetailsCard(),
                            const SizedBox(height: 12),
                            if (_canActOnAppointment) ...[
                              _visitActionBar(),
                              const SizedBox(height: 12),
                            ],
                          ],
                          if (_emrMissing) ...[
                            _emrSoftBanner(),
                            const SizedBox(height: 12),
                          ],
                          ...(_chart != null
                              ? _buildTabContent()
                              : _buildFallbackOverview()),
                          if (_tabIndex == 0 || _tabIndex == 1) ...[
                            const SizedBox(height: 12),
                            SizedBox(
                              width: double.infinity,
                              child: OutlinedButton.icon(
                                onPressed: _writeClinicalNote,
                                icon: const Icon(Icons.edit_note_rounded),
                                label: const Text('Write on EMR'),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: const Color(0xFF0B74FA),
                                  side: const BorderSide(
                                      color: Color(0xFF0B74FA)),
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 14),
                                ),
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

  Widget _visitActionBar() {
    final id = widget.appointmentId!;
    final pending = widget.appointmentStatus == null ||
        widget.appointmentStatus == 'Pending';
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          Row(
            children: [
              if (pending) ...[
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => VisitActions.markArrived(
                      context,
                      appointmentId: id,
                      onDone: _load,
                    ),
                    child: const Text('Arrived'),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Expanded(
                child: ElevatedButton(
                  onPressed: () => VisitActions.showCompleteSheet(
                    context,
                    patient: _displayName,
                    time: widget.appointmentTime ?? '',
                    appointmentId: id,
                    patientId: widget.patientId,
                    onDone: _load,
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0B74FA),
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Complete'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => VisitActions.reschedule(
                    context,
                    appointmentId: id,
                    onDone: _load,
                  ),
                  child: const Text('Reschedule'),
                ),
              ),
            ],
          ),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => VisitActions.markNoShow(
                    context,
                    appointmentId: id,
                    onDone: _load,
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFE53935),
                  ),
                  child: const Text('No show'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextButton(
                  onPressed: () => VisitActions.cancel(
                    context,
                    appointmentId: id,
                    onDone: _load,
                  ),
                  child: const Text('Cancel visit'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _appointmentDetailsCard() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0B74FA).withValues(alpha: 0.06),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.event_available_rounded,
                  color: Color(0xFF0B74FA), size: 20),
              SizedBox(width: 8),
              Text(
                'Appointment details',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1A1B1E),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (widget.appointmentTime != null)
            _detailRow(Icons.schedule_rounded, 'Time', widget.appointmentTime!),
          if (widget.appointmentDuration != null)
            _detailRow(
                Icons.timelapse_rounded, 'Duration', widget.appointmentDuration!),
          if (widget.appointmentStatus != null)
            _detailRow(
                Icons.flag_outlined, 'Status', widget.appointmentStatus!),
          if (widget.appointmentReason != null &&
              widget.appointmentReason!.trim().isNotEmpty)
            _detailRow(
                Icons.local_hospital_outlined, 'Reason', widget.appointmentReason!),
          if (widget.appointmentNotes != null &&
              widget.appointmentNotes!.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFDE7),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  noteLabel('Visit notes / report'),
                  Text(
                    widget.appointmentNotes!,
                    style: const TextStyle(
                        fontSize: 13.5, color: Color(0xFF1A1B1E), height: 1.35),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _detailRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF0B74FA)),
          const SizedBox(width: 8),
          SizedBox(
            width: 72,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF929296),
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1A1B1E),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _emrSoftBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8E1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFFE082)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.sync_rounded, color: Color(0xFFF9A825), size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'OpenEMR chart is still syncing for this patient. You can review the chart below and write clinical notes — they attach once the link completes.',
              style: const TextStyle(
                fontSize: 13,
                height: 1.35,
                color: Color(0xFF6D4C41),
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildFallbackOverview() => [
        Container(
          decoration: BoxDecoration(
              color: Colors.white, borderRadius: BorderRadius.circular(16)),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  patientAvatar(radius: 28),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _displayName,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF1A1B1E),
                          ),
                        ),
                        Text(
                          _subtitle,
                          style: const TextStyle(
                              fontSize: 13, color: Color(0xFF929296)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  _statBox('Age', widget.age != null ? '${widget.age} y' : '—'),
                  const SizedBox(width: 8),
                  _statBox('Gender', widget.gender ?? '—'),
                  const SizedBox(width: 8),
                  _statBox(
                    'Source',
                    _hasAppointmentContext ? 'Visit' : 'Directory',
                  ),
                ],
              ),
              const SizedBox(height: 12),
              const Text(
                'Tip: tap the gray heartbeat to generate a visit report.',
                style: TextStyle(fontSize: 13, color: Color(0xFF929296)),
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
                    fontWeight: FontWeight.w700,
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
                fontWeight: FontWeight.w700,
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
            color: Colors.white, borderRadius: BorderRadius.circular(16)),
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
                      fontWeight: FontWeight.w700,
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
              .take(8)
              .map(
                (a) => _line(
                  _mapTitle(a, ['allergen', 'name', 'substance', 'display']),
                  _mapSubtitle(a, ['severity', 'reaction', 'status']),
                  accent: const Color(0xFFE11D48),
                ),
              )
              .toList(),
          onAdd: () => _add((ctx) => showAddAllergySheet(ctx, widget.patientId)),
        ),
      ] else ...[
        const SizedBox(height: 12),
        _emptySection(
          'Allergies',
          'No allergies on file',
          () => _add((ctx) => showAddAllergySheet(ctx, widget.patientId)),
        ),
      ],
      if (chart.medications.isNotEmpty) ...[
        const SizedBox(height: 12),
        _sectionCard(
          'Medications',
          chart.medications
              .take(8)
              .map(
                (m) => _line(
                  _mapTitle(m, ['name', 'medication', 'display']),
                  _mapSubtitle(m, ['dosage', 'frequency', 'status']),
                ),
              )
              .toList(),
          onAdd: () =>
              _add((ctx) => showAddMedicationSheet(ctx, widget.patientId)),
        ),
      ] else ...[
        const SizedBox(height: 12),
        _emptySection(
          'Medications',
          'No medications on file',
          () => _add((ctx) => showAddMedicationSheet(ctx, widget.patientId)),
        ),
      ],
      if (chart.conditions.isNotEmpty) ...[
        const SizedBox(height: 12),
        _sectionCard(
          'Conditions',
          chart.conditions
              .take(8)
              .map(
                (c) => _line(
                  _mapTitle(c, ['name', 'code', 'display', 'condition']),
                  _mapSubtitle(c, ['status', 'onsetDate', 'recordedDate', 'icd10Code']),
                ),
              )
              .toList(),
          onAdd: () =>
              _add((ctx) => showAddConditionSheet(ctx, widget.patientId)),
        ),
      ] else ...[
        const SizedBox(height: 12),
        _emptySection(
          'Conditions',
          'No conditions on file',
          () => _add((ctx) => showAddConditionSheet(ctx, widget.patientId)),
        ),
      ],
      if (chart.vitalSigns.isNotEmpty) ...[
        const SizedBox(height: 12),
        _sectionCard(
          'Vital signs',
          chart.vitalSigns
              .take(6)
              .map(
                (v) => _line(
                  _fmtDate(v['date']),
                  [
                    if (v['bloodPressure'] != null) 'BP ${v['bloodPressure']}',
                    if (v['heartRate'] != null) 'HR ${v['heartRate']}',
                    if (v['temperatureCelsius'] != null)
                      'Temp ${v['temperatureCelsius']}°C',
                    if (v['oxygenSaturation'] != null)
                      'SpO₂ ${v['oxygenSaturation']}%',
                    if (v['weightKg'] != null) 'Wt ${v['weightKg']} kg',
                  ].join(' · '),
                ),
              )
              .toList(),
          onAdd: () => _add((ctx) => showAddVitalSheet(ctx, widget.patientId)),
        ),
      ] else ...[
        const SizedBox(height: 12),
        _emptySection(
          'Vital signs',
          'No vitals recorded',
          () => _add((ctx) => showAddVitalSheet(ctx, widget.patientId)),
        ),
      ],
      if (chart.labResults.isNotEmpty) ...[
        const SizedBox(height: 12),
        _sectionCard(
          'Laboratory',
          chart.labResults
              .take(8)
              .map(
                (l) => _line(
                  _mapTitle(l, ['testName', 'name', 'test', 'display']),
                  _mapSubtitle(l, [
                    'result',
                    'unit',
                    'referenceRange',
                    'status',
                    'reviewedBy',
                    'clinicName',
                  ]),
                ),
              )
              .toList(),
          onAdd: () =>
              _add((ctx) => showAddLabResultSheet(ctx, widget.patientId)),
        ),
      ] else ...[
        const SizedBox(height: 12),
        _emptySection(
          'Laboratory',
          'No lab results on file',
          () => _add((ctx) => showAddLabResultSheet(ctx, widget.patientId)),
        ),
      ],
      if (chart.carePlans.isNotEmpty) ...[
        const SizedBox(height: 12),
        _sectionCard(
          'Care plans',
          chart.carePlans
              .take(8)
              .map(
                (p) => _line(
                  _mapTitle(p, ['title', 'name', 'display']),
                  _mapSubtitle(p, [
                    'status',
                    'goals',
                    'assignedBy',
                    'clinicName',
                  ]),
                ),
              )
              .toList(),
          onAdd: () =>
              _add((ctx) => showAddCarePlanSheet(ctx, widget.patientId)),
        ),
      ] else ...[
        const SizedBox(height: 12),
        _emptySection(
          'Care plans',
          'No care plans on file',
          () => _add((ctx) => showAddCarePlanSheet(ctx, widget.patientId)),
        ),
      ],
      ..._contactSection(chart),
      ..._emergencySection(chart),
      ..._immunizationSection(chart),
    ];
  }

  Future<void> _add(
    Future<PatientEmrChart?> Function(BuildContext ctx) open,
  ) async {
    try {
      final chart = await open(context);
      if (chart != null && mounted) {
        setState(() {
          _chart = chart;
          _emrMissing = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Saved to OpenEMR chart')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.toString().replaceFirst(RegExp(r'^Exception:\s*'), ''),
          ),
        ),
      );
    }
  }

  List<Widget> _contactSection(PatientEmrChart chart) {
    final c = chart.contactInformation;
    final phone = c['phone']?.toString() ??
        c['phoneNumber']?.toString() ??
        chart.patient['phone']?.toString();
    final email = c['email']?.toString();
    final address = [
      c['addressLine1'],
      c['city'],
      c['state'],
      c['postalCode'],
    ].where((e) => e != null && e.toString().trim().isNotEmpty).join(', ');
    if ((phone == null || phone.isEmpty) &&
        (email == null || email.isEmpty) &&
        address.isEmpty) {
      return const [];
    }
    return [
      const SizedBox(height: 12),
      _sectionCard(
        'Contact',
        [
          if (phone != null && phone.isNotEmpty) _line('Phone', phone),
          if (email != null && email.isNotEmpty) _line('Email', email),
          if (address.isNotEmpty) _line('Address', address),
        ],
      ),
    ];
  }

  List<Widget> _emergencySection(PatientEmrChart chart) {
    if (chart.emergencyContacts.isEmpty) return const [];
    return [
      const SizedBox(height: 12),
      _sectionCard(
        'Emergency contacts',
        chart.emergencyContacts
            .take(4)
            .map(
              (e) => _line(
                _mapTitle(e, ['name', 'display']),
                _mapSubtitle(e, ['relationship', 'phone', 'email']),
                accent: const Color(0xFFE65C00),
              ),
            )
            .toList(),
      ),
    ];
  }

  List<Widget> _immunizationSection(PatientEmrChart chart) {
    if (chart.immunizations.isEmpty) return const [];
    return [
      const SizedBox(height: 12),
      _sectionCard(
        'Immunizations',
        chart.immunizations
            .take(8)
            .map(
              (i) => _line(
                _mapTitle(i, ['name', 'vaccine', 'display']),
                _mapSubtitle(i, ['date', 'status', 'dose']),
              ),
            )
            .toList(),
      ),
    ];
  }

  List<Widget> _buildVisitHistoryContent({required bool showAll}) {
    final encounters = _chart?.encounters ?? const [];
    final clinicVisits = _visits;
    final encounterWidgets = (showAll ? encounters : encounters.take(3))
        .map(
          (e) => _visitTile(
            _mapTitle(e, ['type', 'reason', 'class', 'display', 'status']),
            [
              if (e['periodStart'] != null || e['start'] != null)
                _fmtDate(e['periodStart'] ?? e['start']),
              if (e['practitioner'] != null) e['practitioner'].toString(),
              if (e['status'] != null) e['status'].toString(),
            ].where((s) => s.isNotEmpty).join(' · '),
          ),
        )
        .toList();
    final visitWidgets = (showAll ? clinicVisits : clinicVisits.take(5))
        .map(
          (a) => _visitTile(
            a.reason?.trim().isNotEmpty == true ? a.reason!.trim() : 'Clinic visit',
            [
              DateFormat.yMMMd().add_jm().format(a.scheduledAt),
              a.uiStatus ?? a.status,
              if (a.notes != null && a.notes!.trim().isNotEmpty) 'Has notes',
            ].join(' · '),
          ),
        )
        .toList();
    final items = [...visitWidgets, ...encounterWidgets];
    return [
      if (showAll)
        const Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: Text(
            'Visit history',
            style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
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
        ...items,
    ];
  }

  Widget _visitTile(String title, String subtitle) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
            color: Colors.white, borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1A1B1E),
              ),
            ),
            if (subtitle.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: const TextStyle(fontSize: 12, color: Color(0xFF929296)),
              ),
            ],
          ],
        ),
      );

  List<Widget> _buildNotesContent() {
    final notes = _chart?.clinicalNotes ?? const [];
    return [
      SizedBox(
        width: double.infinity,
        child: FilledButton.icon(
          onPressed: _writeClinicalNote,
          icon: const Icon(Icons.edit_note_rounded),
          label: const Text('Write clinical note'),
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF0B74FA),
            padding: const EdgeInsets.symmetric(vertical: 12),
          ),
        ),
      ),
      const SizedBox(height: 12),
      if (notes.isEmpty)
        const Text(
          'No clinical notes on file yet — add the first one above.',
          style: TextStyle(color: Color(0xFF929296)),
        )
      else
        ...notes.take(12).map(
              (n) => Container(
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12)),
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
            ),
    ];
  }

  List<Widget> _buildDocumentsContent() {
    final labs = _chart?.labResults ?? const [];
    final docs = _chart?.documents ?? const [];
    if (labs.isEmpty && docs.isEmpty) {
      return [
        const Text(
          'Documents',
          style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
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
            fontWeight: FontWeight.w700,
            color: Color(0xFF1A1B1E)),
      ),
      const SizedBox(height: 8),
      ...docs.map((doc) => _fileRow(
            _mapTitle(doc, ['fileName', 'name', 'type', 'display']),
            _mapSubtitle(doc, ['type', 'status', 'uploadedAt']),
          )),
      ...labs.map(
        (doc) => _fileRow(
          _mapTitle(doc, ['name', 'test', 'testName', 'display', 'code']),
          _mapSubtitle(doc, ['result', 'value', 'unit', 'status', 'date']),
        ),
      ),
    ];
  }

  Widget _fileRow(String title, String subtitle) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
            color: Colors.white, borderRadius: BorderRadius.circular(12)),
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
                    title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF1A1B1E),
                    ),
                  ),
                  if (subtitle.isNotEmpty)
                    Text(
                      subtitle,
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF929296)),
                    ),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _sectionCard(String title, List<Widget> children, {VoidCallback? onAdd}) => Container(
        decoration: BoxDecoration(
            color: Colors.white, borderRadius: BorderRadius.circular(16)),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1A1B1E),
                    ),
                  ),
                ),
                if (onAdd != null)
                  TextButton.icon(
                    onPressed: onAdd,
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('Add'),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            ...children,
          ],
        ),
      );

  Widget _emptySection(String title, String empty, VoidCallback onAdd) =>
      _sectionCard(
        title,
        [
          Text(empty, style: const TextStyle(color: Color(0xFF929296))),
        ],
        onAdd: onAdd,
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
            borderRadius: BorderRadius.circular(10),
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
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1A1B1E)),
              ),
            ],
          ),
        ),
      );
}

/// Gray heartbeat control from the CMS doctor UI — opens generate visit report.
class _GrayHeartbeatButton extends StatelessWidget {
  const _GrayHeartbeatButton({
    required this.pulse,
    required this.onTap,
    this.onHeader = false,
  });

  final AnimationController pulse;
  final VoidCallback onTap;
  final bool onHeader;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: pulse,
      builder: (_, __) {
        final scale = 1 + (0.06 * pulse.value);
        final icon = SvgPicture.asset(
          AppAssets.heartbeat,
          width: onHeader ? 22 : 28,
          height: onHeader ? 22 : 28,
          colorFilter: ColorFilter.mode(
            onHeader ? Colors.white : const Color(0xFF929296),
            BlendMode.srcIn,
          ),
        );

        if (onHeader) {
          return Tooltip(
            message: 'Generate report',
            child: GestureDetector(
              onTap: onTap,
              child: Transform.scale(
                scale: scale,
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  alignment: Alignment.center,
                  child: icon,
                ),
              ),
            ),
          );
        }

        return Transform.scale(
          scale: scale,
          child: FloatingActionButton(
            onPressed: onTap,
            tooltip: 'Generate report',
            backgroundColor: const Color(0xFFF5F5F5),
            foregroundColor: const Color(0xFF929296),
            elevation: 2,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: Color(0xFFDBDBDC)),
            ),
            child: icon,
          ),
        );
      },
    );
  }
}

class _HeartbeatReportFab extends StatelessWidget {
  const _HeartbeatReportFab({required this.pulse, required this.onTap});

  final AnimationController pulse;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _GrayHeartbeatButton(pulse: pulse, onTap: onTap);
  }
}
