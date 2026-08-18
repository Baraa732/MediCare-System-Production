import 'dart:typed_data';

import 'package:cms/core/entities/patient_emr.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

/// Builds a printable OpenEMR / FHIR-structured patient chart PDF
/// from the live `/emr/me` payload.
class EmrPdfService {
  Future<void> shareChart(PatientEmrChart chart) async {
    final bytes = await build(chart);
    final name = _fileName(chart);
    await Printing.sharePdf(bytes: bytes, filename: name);
  }

  Future<void> printChart(PatientEmrChart chart) async {
    await Printing.layoutPdf(
      name: _fileName(chart),
      onLayout: (_) => build(chart),
    );
  }

  String _fileName(PatientEmrChart chart) {
    final who = chart.patient.fullName.isEmpty
        ? 'patient'
        : chart.patient.fullName.replaceAll(RegExp(r'[^A-Za-z0-9]+'), '_');
    final day = DateFormat('yyyyMMdd').format(DateTime.now());
    return 'MediCare_EMR_${who}_$day.pdf';
  }

  Future<Uint8List> build(PatientEmrChart chart) async {
    final doc = pw.Document(title: 'MediCare OpenEMR Chart');
    final generated = DateFormat.yMMMd().add_jm().format(DateTime.now());
    final name = chart.patient.fullName.isEmpty ? 'Patient' : chart.patient.fullName;

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.fromLTRB(36, 40, 36, 40),
        header: (_) => pw.Container(
          padding: const pw.EdgeInsets.only(bottom: 10),
          decoration: const pw.BoxDecoration(
            border: pw.Border(
              bottom: pw.BorderSide(color: PdfColor.fromInt(0xFF0B74FA), width: 1.4),
            ),
          ),
          child: pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    'MediCare Health Record',
                    style: pw.TextStyle(
                      fontSize: 16,
                      fontWeight: pw.FontWeight.bold,
                      color: PdfColor.fromInt(0xFF0B74FA),
                    ),
                  ),
                  pw.Text(
                    'OpenEMR Standard + FHIR R4 chart',
                    style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700),
                  ),
                ],
              ),
              pw.Text(generated, style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600)),
            ],
          ),
        ),
        footer: (ctx) => pw.Container(
          padding: const pw.EdgeInsets.only(top: 8),
          alignment: pw.Alignment.centerRight,
          child: pw.Text(
            'Page ${ctx.pageNumber} of ${ctx.pagesCount}  ·  Cash visits only · no billing in MediCare',
            style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
          ),
        ),
        build: (context) => [
          _h('Patient', 'FHIR Patient'),
          _kv([
            ['Name', name],
            ['Birth date', _d(chart.patient.birthDate)],
            ['Gender', chart.patient.gender ?? '—'],
            ['Marital status', chart.patient.maritalStatus ?? '—'],
            ['Language', chart.patient.language ?? '—'],
            ['National ID', chart.patient.nationalId ?? '—'],
            ['Phone', chart.contactInformation.phone ?? '—'],
            ['Email', chart.contactInformation.email ?? '—'],
            ['Address', chart.contactInformation.addressLine.isEmpty ? '—' : chart.contactInformation.addressLine],
          ]),
          _h('Allergies', 'FHIR AllergyIntolerance'),
          _table(
            ['Allergen', 'Reaction', 'Severity', 'Recorded'],
            chart.allergies
                .map((a) => [a.allergen ?? '—', a.reaction ?? '—', a.severity ?? '—', _d(a.recordedDate)])
                .toList(),
          ),
          _h('Medications', 'FHIR MedicationRequest'),
          _table(
            ['Name', 'Dose / frequency', 'Route', 'Status'],
            chart.medications
                .map(
                  (m) => [
                    m.name ?? '—',
                    [m.dosage, m.frequency].whereType<String>().join(' · ').ifEmpty('—'),
                    m.route ?? '—',
                    m.status ?? '—',
                  ],
                )
                .toList(),
          ),
          _h('Conditions / problems', 'FHIR Condition'),
          _table(
            ['Name', 'ICD-10', 'Status', 'Diagnosed'],
            [
              ...chart.conditions.map(
                (c) => [c.name ?? '—', c.icd10Code ?? '—', c.status ?? '—', _d(c.diagnosedDate)],
              ),
              ...chart.problems.map(
                (p) => [p.name ?? '—', p.icd10Code ?? '—', p.status ?? '—', _d(p.diagnosedDate)],
              ),
            ],
          ),
          _h('Encounters', 'FHIR Encounter'),
          _table(
            ['Date', 'Type', 'Clinic / provider', 'Reason'],
            chart.encounters
                .map(
                  (e) => [
                    _dt(e.date),
                    e.type ?? '—',
                    [e.clinic, e.provider].whereType<String>().join(' · ').ifEmpty('—'),
                    e.reason ?? '—',
                  ],
                )
                .toList(),
          ),
          _h('Vital signs', 'FHIR Observation'),
          _table(
            ['Date', 'BP', 'HR', 'Temp', 'SpO₂', 'Weight'],
            chart.vitalSigns
                .map(
                  (v) => [
                    _dt(v.date),
                    v.bloodPressure ?? '—',
                    v.heartRate == null ? '—' : v.heartRate!.toStringAsFixed(0),
                    v.temperatureCelsius == null ? '—' : '${v.temperatureCelsius!.toStringAsFixed(1)}°C',
                    v.oxygenSaturation == null ? '—' : '${v.oxygenSaturation!.toStringAsFixed(0)}%',
                    v.weightKg == null ? '—' : '${v.weightKg!.toStringAsFixed(1)} kg',
                  ],
                )
                .toList(),
          ),
          _h('Laboratory', 'FHIR Observation / DiagnosticReport'),
          _table(
            ['Test', 'Result', 'Ref', 'Status', 'Date'],
            chart.labResults
                .map(
                  (l) => [
                    l.testName ?? '—',
                    [l.result, l.unit].whereType<String>().join(' ').ifEmpty('—'),
                    l.referenceRange ?? '—',
                    l.status ?? '—',
                    _d(l.performedDate),
                  ],
                )
                .toList(),
          ),
          _h('Immunizations', 'FHIR Immunization'),
          _table(
            ['Vaccine', 'Date', 'Lot', 'By'],
            chart.immunizations
                .map(
                  (i) => [
                    i.vaccine ?? '—',
                    _d(i.dateAdministered),
                    i.lotNumber ?? '—',
                    i.administeredBy ?? '—',
                  ],
                )
                .toList(),
          ),
          _h('Care plans', 'FHIR CarePlan'),
          _table(
            ['Title', 'Status', 'Goals', 'Start'],
            chart.carePlans
                .map(
                  (p) => [
                    p.title ?? '—',
                    p.status ?? '—',
                    p.goals.isEmpty ? '—' : p.goals.join(', '),
                    _d(p.startDate),
                  ],
                )
                .toList(),
          ),
          _h('Clinical notes', 'OpenEMR notes'),
          _table(
            ['Date', 'Type', 'Author', 'Content'],
            chart.clinicalNotes
                .map((n) => [_dt(n.date), n.type ?? '—', n.author ?? '—', n.content ?? '—'])
                .toList(),
          ),
          _h('Documents', 'FHIR DocumentReference'),
          _table(
            ['File', 'Type', 'Status', 'Uploaded'],
            chart.documents
                .map((d) => [d.fileName ?? '—', d.type ?? '—', d.status ?? '—', _d(d.uploadedAt)])
                .toList(),
          ),
          pw.SizedBox(height: 14),
          pw.Text(
            'Source: OpenEMR patient_data + FHIR R4. Empty rows mean no clinician has written that resource yet.',
            style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
          ),
        ],
      ),
    );

    return doc.save();
  }

  pw.Widget _h(String title, String resource) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(top: 14, bottom: 6),
      child: pw.Row(
        children: [
          pw.Text(title, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(width: 8),
          pw.Text(resource, style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600)),
        ],
      ),
    );
  }

  pw.Widget _kv(List<List<String>> rows) {
    return pw.Table(
      columnWidths: {0: const pw.FixedColumnWidth(110), 1: const pw.FlexColumnWidth()},
      children: [
        for (final row in rows)
          pw.TableRow(
            children: [
              pw.Padding(
                padding: const pw.EdgeInsets.symmetric(vertical: 2),
                child: pw.Text(row[0], style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700)),
              ),
              pw.Padding(
                padding: const pw.EdgeInsets.symmetric(vertical: 2),
                child: pw.Text(row[1], style: const pw.TextStyle(fontSize: 9)),
              ),
            ],
          ),
      ],
    );
  }

  pw.Widget _table(List<String> headers, List<List<String>> rows) {
    if (rows.isEmpty) return _empty('No records');
    return pw.TableHelper.fromTextArray(
      headers: headers,
      data: rows,
      headerStyle: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold, color: PdfColors.white),
      headerDecoration: const pw.BoxDecoration(color: PdfColor.fromInt(0xFF0B74FA)),
      cellStyle: const pw.TextStyle(fontSize: 8),
      cellAlignment: pw.Alignment.centerLeft,
      headerAlignment: pw.Alignment.centerLeft,
    );
  }

  pw.Widget _empty(String text) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 6),
      child: pw.Text(text, style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey600)),
    );
  }

  String _d(String? raw) {
    if (raw == null || raw.isEmpty) return '—';
    final dt = DateTime.tryParse(raw);
    if (dt == null) return raw;
    return DateFormat.yMMMd().format(dt.toLocal());
  }

  String _dt(String? raw) {
    if (raw == null || raw.isEmpty) return '—';
    final dt = DateTime.tryParse(raw);
    if (dt == null) return raw;
    return DateFormat.yMMMd().add_jm().format(dt.toLocal());
  }
}

extension on String {
  String ifEmpty(String fallback) => trim().isEmpty ? fallback : this;
}
