import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Bottom sheet for doctors to write a visit report for a patient.
class GenerateVisitReportSheet extends StatefulWidget {
  const GenerateVisitReportSheet({
    super.key,
    required this.patientId,
    required this.patientName,
    this.appointmentId,
    this.appointmentLabel,
  });

  final String patientId;
  final String patientName;
  final String? appointmentId;
  final String? appointmentLabel;

  @override
  State<GenerateVisitReportSheet> createState() =>
      _GenerateVisitReportSheetState();
}

class _GenerateVisitReportSheetState extends State<GenerateVisitReportSheet> {
  final _diagnosisCtrl = TextEditingController();
  final _findingsCtrl = TextEditingController();
  final _planCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _saving = false;
  String? _error;
  String? _resolvedAppointmentId;
  String? _resolvedLabel;

  @override
  void initState() {
    super.initState();
    _resolvedAppointmentId = widget.appointmentId;
    _resolvedLabel = widget.appointmentLabel;
    if (_resolvedAppointmentId == null || _resolvedAppointmentId!.isEmpty) {
      _resolveLatestAppointment();
    }
  }

  Future<void> _resolveLatestAppointment() async {
    try {
      final now = DateTime.now();
      final list = await appointmentApi.getMySchedule(
        from: now.subtract(const Duration(days: 60)),
        to: now.add(const Duration(days: 14)),
      );
      final forPatient = list
          .where((a) => a.patientId == widget.patientId)
          .toList()
        ..sort((a, b) => b.scheduledAt.compareTo(a.scheduledAt));
      if (!mounted || forPatient.isEmpty) return;
      final a = forPatient.first;
      setState(() {
        _resolvedAppointmentId = a.id;
        _resolvedLabel = '${a.timeLabel} · ${a.uiStatus ?? a.status}';
      });
    } catch (_) {}
  }

  @override
  void dispose() {
    _diagnosisCtrl.dispose();
    _findingsCtrl.dispose();
    _planCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final appointmentId = _resolvedAppointmentId;
    if (appointmentId == null || appointmentId.isEmpty) {
      setState(() => _error = 'No appointment found for this patient yet.');
      return;
    }
    final report = [
      if (_diagnosisCtrl.text.trim().isNotEmpty)
        'Diagnosis: ${_diagnosisCtrl.text.trim()}',
      if (_findingsCtrl.text.trim().isNotEmpty)
        'Findings: ${_findingsCtrl.text.trim()}',
      if (_planCtrl.text.trim().isNotEmpty)
        'Plan: ${_planCtrl.text.trim()}',
      if (_notesCtrl.text.trim().isNotEmpty)
        'Notes: ${_notesCtrl.text.trim()}',
    ].join('\n');
    if (report.trim().isEmpty) {
      setState(() => _error = 'Add at least one field before saving.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await appointmentApi.updateNotes(appointmentId, report);
      try {
        await emrApi.addClinicalNote(
          widget.patientId,
          content: report,
          type: 'Visit report',
        );
      } catch (_) {}
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          top: false,
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFDBDBDC),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFEBEE),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(
                        Icons.monitor_heart_rounded,
                        color: Color(0xFFE53935),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Generate visit report',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF1A1B1E),
                            ),
                          ),
                          Text(
                            widget.patientName,
                            style: const TextStyle(
                              fontSize: 13,
                              color: Color(0xFF929296),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                if (_resolvedLabel != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEEF4FF),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      'Linked visit · $_resolvedLabel',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0B74FA),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                _field('Diagnosis', _diagnosisCtrl, 'e.g. Hypertension follow-up'),
                const SizedBox(height: 12),
                _field('Clinical findings', _findingsCtrl, 'Exam findings…',
                    maxLines: 3),
                const SizedBox(height: 12),
                _field('Treatment plan', _planCtrl, 'Next steps…', maxLines: 3),
                const SizedBox(height: 12),
                _field('Additional notes', _notesCtrl, 'Optional notes…',
                    maxLines: 3),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: const TextStyle(color: Color(0xFFE53935), fontSize: 13),
                  ),
                ],
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: _saving ? null : _save,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0B74FA),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: _saving
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.4,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Save report',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 16,
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _field(
    String label,
    TextEditingController ctrl,
    String hint, {
    int maxLines = 1,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1A1B1E),
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          maxLines: maxLines,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Color(0xFFB6B7B9), fontSize: 14),
            filled: true,
            fillColor: const Color(0xFFF5F5F5),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 12,
            ),
          ),
        ),
      ],
    );
  }
}
