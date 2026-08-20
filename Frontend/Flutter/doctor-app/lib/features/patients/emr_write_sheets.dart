import 'package:cms_doctor_app/core/api/services/emr_api_service.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';

Future<PatientEmrChart?> showAddAllergySheet(
  BuildContext context,
  String patientId,
) {
  return _showFields(
    context,
    title: 'Add allergy',
    fields: const [
      _Field('allergen', 'Allergen', required: true),
      _Field('reaction', 'Reaction'),
      _Field('severity', 'Severity'),
    ],
    save: (v) => emrApi.addAllergy(
      patientId,
      allergen: v['allergen']!,
      reaction: v['reaction'],
      severity: v['severity'],
    ),
  );
}

Future<PatientEmrChart?> showAddMedicationSheet(
  BuildContext context,
  String patientId,
) {
  return _showFields(
    context,
    title: 'Add medication',
    fields: const [
      _Field('name', 'Name', required: true),
      _Field('dosage', 'Dosage'),
      _Field('frequency', 'Frequency'),
      _Field('route', 'Route'),
    ],
    save: (v) => emrApi.addMedication(
      patientId,
      name: v['name']!,
      dosage: v['dosage'],
      frequency: v['frequency'],
      route: v['route'],
    ),
  );
}

Future<PatientEmrChart?> showAddConditionSheet(
  BuildContext context,
  String patientId,
) {
  return _showFields(
    context,
    title: 'Add condition',
    fields: const [
      _Field('name', 'Name', required: true),
      _Field('icd10Code', 'ICD-10'),
      _Field('status', 'Status'),
    ],
    save: (v) => emrApi.addCondition(
      patientId,
      name: v['name']!,
      icd10Code: v['icd10Code'],
      status: v['status'],
    ),
  );
}

Future<PatientEmrChart?> showAddVitalSheet(
  BuildContext context,
  String patientId,
) {
  return _showFields(
    context,
    title: 'Add vital signs',
    fields: const [
      _Field('bloodPressure', 'Blood pressure (120/80)'),
      _Field('heartRate', 'Heart rate'),
      _Field('temperatureCelsius', 'Temperature °C'),
      _Field('oxygenSaturation', 'SpO₂ %'),
      _Field('weightKg', 'Weight kg'),
      _Field('heightCm', 'Height cm'),
    ],
    save: (v) => emrApi.addVital(
      patientId,
      bloodPressure: v['bloodPressure'],
      heartRate: _num(v['heartRate']),
      temperatureCelsius: _num(v['temperatureCelsius']),
      oxygenSaturation: _num(v['oxygenSaturation']),
      weightKg: _num(v['weightKg']),
      heightCm: _num(v['heightCm']),
    ),
  );
}

double? _num(String? raw) =>
    raw == null || raw.isEmpty ? null : double.tryParse(raw);

class _Field {
  const _Field(this.key, this.label, {this.required = false});
  final String key;
  final String label;
  final bool required;
}

Future<PatientEmrChart?> _showFields(
  BuildContext context, {
  required String title,
  required List<_Field> fields,
  required Future<PatientEmrChart> Function(Map<String, String?> values) save,
}) {
  return showModalBottomSheet<PatientEmrChart>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => _WriteSheet(title: title, fields: fields, save: save),
  );
}

class _WriteSheet extends StatefulWidget {
  const _WriteSheet({
    required this.title,
    required this.fields,
    required this.save,
  });

  final String title;
  final List<_Field> fields;
  final Future<PatientEmrChart> Function(Map<String, String?> values) save;

  @override
  State<_WriteSheet> createState() => _WriteSheetState();
}

class _WriteSheetState extends State<_WriteSheet> {
  late final Map<String, TextEditingController> _ctrls;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _ctrls = {
      for (final f in widget.fields) f.key: TextEditingController(),
    };
  }

  @override
  void dispose() {
    for (final c in _ctrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    final values = <String, String?>{};
    for (final f in widget.fields) {
      final text = _ctrls[f.key]!.text.trim();
      if (f.required && text.isEmpty) {
        setState(() => _error = '${f.label} is required');
        return;
      }
      values[f.key] = text.isEmpty ? null : text;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final chart = await widget.save(values);
      if (!mounted) return;
      Navigator.pop(context, chart);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = _friendlyError(e);
      });
    }
  }

  String _friendlyError(Object e) {
    final raw = e.toString();
    final cleaned = raw
        .replaceFirst(RegExp(r'^Exception:\s*'), '')
        .replaceFirst(RegExp(r'^ApiException:\s*'), '')
        .trim();
    if (cleaned.isEmpty) {
      return 'Could not save to OpenEMR. Please try again.';
    }
    if (cleaned.toLowerCase().contains('something went wrong')) {
      return 'OpenEMR could not save this entry. Check the chart link and try again.';
    }
    return cleaned;
  }

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + inset),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  widget.title,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1A1B1E),
                  ),
                ),
                const SizedBox(height: 12),
                for (final f in widget.fields) ...[
                  TextField(
                    controller: _ctrls[f.key],
                    keyboardType: f.key.contains('Rate') ||
                            f.key.contains('Cm') ||
                            f.key.contains('Kg') ||
                            f.key.contains('temperature') ||
                            f.key.contains('oxygen')
                        ? const TextInputType.numberWithOptions(decimal: true)
                        : TextInputType.text,
                    decoration: InputDecoration(
                      labelText: f.required ? '${f.label} *' : f.label,
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text(_error!,
                        style: const TextStyle(color: Color(0xFFE53935))),
                  ),
                FilledButton(
                  onPressed: _busy ? null : _submit,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF0B74FA),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: Text(_busy ? 'Saving…' : 'Save to OpenEMR'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
