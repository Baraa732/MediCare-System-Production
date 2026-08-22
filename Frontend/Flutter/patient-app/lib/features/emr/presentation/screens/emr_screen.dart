import 'package:cms/core/animations/fade_slide_in.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/entities/patient_emr.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/features/emr/data/emr_pdf_service.dart';
import 'package:cms/features/emr/presentation/cubit/emr_cubit.dart';
import 'package:cms/features/emr/presentation/cubit/emr_state.dart';
import 'package:cms/injection_container.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

class EmrScreen extends StatelessWidget {
  static const routeName = '/emr';

  const EmrScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => getIt<EmrCubit>()..load(),
      child: const _EmrView(),
    );
  }
}

class _EmrView extends StatefulWidget {
  const _EmrView();

  @override
  State<_EmrView> createState() => _EmrViewState();
}

class _EmrViewState extends State<_EmrView> {
  final _pdf = EmrPdfService();
  bool _exporting = false;

  Future<void> _sharePdf(PatientEmrChart chart) async {
    if (_exporting) return;
    setState(() => _exporting = true);
    try {
      await _pdf.shareChart(chart);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not create the PDF. Try again.')),
      );
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _printPdf(PatientEmrChart chart) async {
    if (_exporting) return;
    setState(() => _exporting = true);
    try {
      await _pdf.printChart(chart);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open print preview.')),
      );
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7FB),
      body: BlocBuilder<EmrCubit, EmrState>(
        builder: (context, headerState) {
          return Column(
            children: [
              _TopBar(
                topInset: top,
                exporting: _exporting,
                subtitle: _headerSubtitle(headerState.activeLink),
                onSharePdf: () {
                  final chart = context.read<EmrCubit>().state.chart;
                  if (chart == null) return;
                  _sharePdf(chart);
                },
                onPrintPdf: () {
                  final chart = context.read<EmrCubit>().state.chart;
                  if (chart == null) return;
                  _printPdf(chart);
                },
              ),
              Expanded(
                child: BlocConsumer<EmrCubit, EmrState>(
              listenWhen: (prev, next) =>
                  next.errorMessage != null &&
                  next.status == EmrLoadStatus.ready &&
                  prev.errorMessage != next.errorMessage,
              listener: (context, state) {
                final msg = state.errorMessage;
                if (msg == null) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(msg)),
                );
              },
              builder: (context, state) {
                switch (state.status) {
                  case EmrLoadStatus.initial:
                  case EmrLoadStatus.loading:
                    return const _LoadingChart();
                  case EmrLoadStatus.pending:
                  case EmrLoadStatus.failure:
                  case EmrLoadStatus.ready:
                    final chart = state.chart ?? PatientEmrChart.empty();
                    return FadeSlideIn(
                      child: Column(
                        children: [
                          if (state.links.isNotEmpty)
                            _ClinicPicker(
                              links: state.links,
                              selectedTenantId: state.selectedTenantId,
                            ),
                          if (state.isSaving)
                            const LinearProgressIndicator(
                              minHeight: 2,
                              color: AppColors.main_background_blue,
                            ),
                          Expanded(
                            child: RefreshIndicator(
                              color: AppColors.main_background_blue,
                              onRefresh: () => context
                                  .read<EmrCubit>()
                                  .load(showLoading: false),
                              child: _ChartBody(
                                chart: chart,
                                exporting: _exporting,
                                onSharePdf: () => _sharePdf(chart),
                                onPrintPdf: () => _printPdf(chart),
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                }
              },
            ),
          ),
            ],
          );
        },
      ),
    );
  }
}

String _headerSubtitle(EmrClinicLink? link) {
  if (link == null) return 'Live OpenEMR chart · cash at clinic';
  final parts = <String>[link.displayName];
  final city = link.clinicCity?.trim();
  if (city != null && city.isNotEmpty) parts.add(city);
  parts.add(link.synced ? 'Synced' : link.syncStatus);
  return parts.join(' · ');
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.topInset,
    required this.exporting,
    required this.subtitle,
    required this.onSharePdf,
    required this.onPrintPdf,
  });

  final double topInset;
  final bool exporting;
  final String subtitle;
  final VoidCallback onSharePdf;
  final VoidCallback onPrintPdf;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(4, topInset + 4, 8, 12),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0B74FA), Color(0xFF0648A8)],
        ),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.arrow_back_ios_new_rounded,
                color: Colors.white, size: 20),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Health record',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Color(0xCCFFFFFF), fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => context.read<EmrCubit>().load(),
            tooltip: 'Refresh from clinic',
            icon: const Icon(Icons.refresh_rounded, color: Colors.white),
          ),
          PopupMenuButton<String>(
            tooltip: 'PDF',
            color: Colors.white,
            onSelected: (value) {
              if (value == 'share') onSharePdf();
              if (value == 'print') onPrintPdf();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(
                value: 'share',
                child: ListTile(
                  dense: true,
                  leading: Icon(Icons.picture_as_pdf_outlined),
                  title: Text('Save / share PDF'),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              PopupMenuItem(
                value: 'print',
                child: ListTile(
                  dense: true,
                  leading: Icon(Icons.print_outlined),
                  title: Text('Print PDF'),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ],
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: exporting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.ios_share_rounded, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}

class _LoadingChart extends StatelessWidget {
  const _LoadingChart();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(color: AppColors.main_background_blue),
          SizedBox(height: 14),
          Text(
            'Loading your OpenEMR chart…',
            style: TextStyle(color: AppColors.CustomgrayDark),
          ),
        ],
      ),
    );
  }
}

class _ClinicPicker extends StatelessWidget {
  const _ClinicPicker({
    required this.links,
    required this.selectedTenantId,
  });

  final List<EmrClinicLink> links;
  final String? selectedTenantId;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Clinic record',
            style: FontHeading.bodySmall.copyWith(
              color: AppColors.CustomgrayDark,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final link in links)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(
                        _clinicLabel(link),
                        style: TextStyle(
                          color: (selectedTenantId ?? '') == (link.id ?? '')
                              ? Colors.white
                              : AppColors.grayDark,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      avatar: link.synced
                          ? null
                          : Icon(
                              Icons.sync_problem_rounded,
                              size: 16,
                              color: (selectedTenantId ?? '') == (link.id ?? '')
                                  ? Colors.white
                                  : AppColors.CustomgrayDark,
                            ),
                      selected: (selectedTenantId ?? '') == (link.id ?? ''),
                      selectedColor: AppColors.main_background_blue,
                      onSelected: (_) {
                        if (link.id != null) {
                          context.read<EmrCubit>().selectClinic(link.id);
                        }
                      },
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _clinicLabel(EmrClinicLink link) {
    if (!link.synced) {
      return '${link.displayName} · ${link.syncStatus.toLowerCase()}';
    }
    return link.displayName;
  }
}

enum _Jump {
  patient,
  allergies,
  medications,
  conditions,
  visits,
  vitals,
  labs,
  vaccines,
  plans,
  notes,
  documents,
}

class _ChartBody extends StatefulWidget {
  const _ChartBody({
    required this.chart,
    required this.exporting,
    required this.onSharePdf,
    required this.onPrintPdf,
  });

  final PatientEmrChart chart;
  final bool exporting;
  final VoidCallback onSharePdf;
  final VoidCallback onPrintPdf;

  @override
  State<_ChartBody> createState() => _ChartBodyState();
}

class _ChartBodyState extends State<_ChartBody> {
  final _keys = {for (final j in _Jump.values) j: GlobalKey()};

  Future<void> _jump(_Jump section) async {
    final ctx = _keys[section]?.currentContext;
    if (ctx == null) return;
    await Scrollable.ensureVisible(
      ctx,
      duration: const Duration(milliseconds: 380),
      curve: Curves.easeOutCubic,
      alignment: 0.08,
    );
  }

  @override
  Widget build(BuildContext context) {
    final chart = widget.chart;
    final conditions = _mergedConditions(chart);
    final careSources = _careSources(chart);
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
      children: [
        _IdentityCard(chart: chart),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _PrimaryAction(
                icon: Icons.picture_as_pdf_rounded,
                label: widget.exporting ? 'Preparing PDF…' : 'Save EMR as PDF',
                onTap: widget.exporting ? null : widget.onSharePdf,
              ),
            ),
            const SizedBox(width: 10),
            _IconAction(
              icon: Icons.print_outlined,
              tooltip: 'Print',
              onTap: widget.exporting ? null : widget.onPrintPdf,
            ),
            const SizedBox(width: 8),
            _IconAction(
              icon: Icons.edit_outlined,
              tooltip: 'Edit patient',
              onTap: () => _openPatientEditor(context, chart),
            ),
          ],
        ),
        if (chart.allergies.isNotEmpty) ...[
          const SizedBox(height: 12),
          _AllergyBanner(items: chart.allergies),
        ],
        const SizedBox(height: 16),
        _GlanceRow(chart: chart, conditionCount: conditions.length),
        if (careSources.isNotEmpty) ...[
          const SizedBox(height: 12),
          _CareSourcesStrip(sources: careSources),
        ],
        const SizedBox(height: 14),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _JumpChip('Patient', () => _jump(_Jump.patient)),
              _JumpChip('Allergies ${chart.allergies.length}',
                  () => _jump(_Jump.allergies)),
              _JumpChip('Meds ${chart.medications.length}',
                  () => _jump(_Jump.medications)),
              _JumpChip('Problems ${conditions.length}',
                  () => _jump(_Jump.conditions)),
              _JumpChip('Visits ${chart.encounters.length}',
                  () => _jump(_Jump.visits)),
              _JumpChip('Vitals ${chart.vitalSigns.length}',
                  () => _jump(_Jump.vitals)),
              _JumpChip('Labs ${chart.labResults.length}',
                  () => _jump(_Jump.labs)),
              _JumpChip('Vaccines ${chart.immunizations.length}',
                  () => _jump(_Jump.vaccines)),
              _JumpChip('Plans ${chart.carePlans.length}',
                  () => _jump(_Jump.plans)),
              _JumpChip('Notes ${chart.clinicalNotes.length}',
                  () => _jump(_Jump.notes)),
              _JumpChip('Files ${chart.documents.length}',
                  () => _jump(_Jump.documents)),
            ],
          ),
        ),
        const SizedBox(height: 18),
        KeyedSubtree(
          key: _keys[_Jump.patient],
          child: _PatientSection(chart: chart),
        ),
        const SizedBox(height: 18),
        KeyedSubtree(
          key: _keys[_Jump.allergies],
          child: _Section(
            fhir: 'AllergyIntolerance',
            title: 'Allergies',
            count: chart.allergies.length,
            emptyTitle: 'No allergies on file',
            emptySubtitle: 'Clinic staff add these when known.',
            icon: Icons.warning_amber_rounded,
            children: [
              for (final a in chart.allergies)
                _RecordCard(
                  accent: const Color(0xFFE11D48),
                  title: a.allergen ?? 'Allergy',
                  lines: [
                    if (a.severity != null) 'Severity: ${a.severity}',
                    if (a.reaction != null) 'Reaction: ${a.reaction}',
                    if (a.recordedBy != null) 'By ${a.recordedBy}',
                    if (a.clinicName != null) 'Clinic: ${a.clinicName}',
                    if (a.recordedDate != null)
                      'Recorded ${_fmtDate(a.recordedDate)}',
                  ],
                ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        KeyedSubtree(
          key: _keys[_Jump.medications],
          child: _Section(
            fhir: 'MedicationRequest',
            title: 'Medications',
            count: chart.medications.length,
            emptyTitle: 'No medications',
            emptySubtitle: 'Prescriptions from visits appear here.',
            icon: Icons.medication_outlined,
            children: [
              for (final m in chart.medications)
                _RecordCard(
                  title: m.name ?? 'Medication',
                  lines: [
                    [m.dosage, m.frequency]
                        .whereType<String>()
                        .join(' · '),
                    if (m.route != null) 'Route: ${m.route}',
                    if (m.prescribedBy != null)
                      'Prescribed by ${m.prescribedBy}',
                    if (m.clinicName != null) 'Clinic: ${m.clinicName}',
                    if (m.startDate != null) 'Started ${_fmtDate(m.startDate)}',
                    if (m.status != null) m.status!,
                  ].where((e) => e.trim().isNotEmpty).toList(),
                ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        KeyedSubtree(
          key: _keys[_Jump.conditions],
          child: _Section(
            fhir: 'Condition',
            title: 'Conditions & problems',
            count: conditions.length,
            emptyTitle: 'No conditions listed',
            emptySubtitle: 'Diagnoses appear after clinic visits.',
            icon: Icons.health_and_safety_outlined,
            children: [
              for (final c in conditions)
                _RecordCard(
                  title: c.title,
                  lines: c.lines.where((e) => e.trim().isNotEmpty).toList(),
                ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        KeyedSubtree(
          key: _keys[_Jump.visits],
          child: _Section(
            fhir: 'Encounter',
            title: 'Visits',
            count: chart.encounters.length,
            emptyTitle: 'No visits yet',
            emptySubtitle: 'Completed clinic encounters appear here.',
            icon: Icons.event_note_outlined,
            children: [
              for (final e in chart.encounters)
                _RecordCard(
                  title: e.type ?? e.reason ?? 'Visit',
                  lines: [
                    _fmtDateTime(e.date),
                    if (e.clinic != null) 'Clinic: ${e.clinic}',
                    if (e.provider != null) 'Provider: ${e.provider}',
                    if (e.reason != null && e.type != null) e.reason!,
                    if (e.diagnosis.isNotEmpty)
                      'Dx: ${e.diagnosis.join(', ')}',
                    if (e.notes != null) e.notes!,
                  ].where((s) => s.isNotEmpty && s != '—').toList(),
                ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        KeyedSubtree(
          key: _keys[_Jump.vitals],
          child: _Section(
            fhir: 'Observation',
            title: 'Vital signs',
            count: chart.vitalSigns.length,
            emptyTitle: 'No vital signs',
            emptySubtitle: 'Vitals recorded during visits appear here.',
            icon: Icons.monitor_heart_outlined,
            children: [
              for (final v in chart.vitalSigns)
                _RecordCard(
                  title: _fmtDateTime(v.date),
                  lines: [
                    if (v.bloodPressure != null) 'BP ${v.bloodPressure}',
                    if (v.heartRate != null)
                      'HR ${v.heartRate!.toStringAsFixed(0)} bpm',
                    if (v.temperatureCelsius != null)
                      'Temp ${v.temperatureCelsius!.toStringAsFixed(1)}°C',
                    if (v.oxygenSaturation != null)
                      'SpO₂ ${v.oxygenSaturation!.toStringAsFixed(0)}%',
                    if (v.weightKg != null)
                      'Wt ${v.weightKg!.toStringAsFixed(1)} kg',
                    if (v.heightCm != null)
                      'Ht ${v.heightCm!.toStringAsFixed(0)} cm',
                    if (v.bmi != null) 'BMI ${v.bmi!.toStringAsFixed(1)}',
                    if (v.respiratoryRate != null)
                      'RR ${v.respiratoryRate!.toStringAsFixed(0)}',
                    if (v.recordedBy != null) 'By ${v.recordedBy}',
                    if (v.clinicName != null) 'Clinic: ${v.clinicName}',
                  ],
                ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        KeyedSubtree(
          key: _keys[_Jump.labs],
          child: _Section(
            fhir: 'Observation / DiagnosticReport',
            title: 'Laboratory',
            count: chart.labResults.length,
            emptyTitle: 'No lab results',
            emptySubtitle: 'Results appear when the clinic posts them.',
            icon: Icons.science_outlined,
            children: [
              for (final lab in chart.labResults)
                _RecordCard(
                  title: lab.testName ?? 'Lab test',
                  lines: [
                    [
                      lab.result,
                      if (lab.unit != null) lab.unit,
                    ].whereType<String>().join(' '),
                    if (lab.referenceRange != null)
                      'Ref: ${lab.referenceRange}',
                    if (lab.status != null) lab.status!,
                    if (lab.performedDate != null)
                      _fmtDate(lab.performedDate),
                    if (lab.reviewedBy != null) 'By ${lab.reviewedBy}',
                    if (lab.clinicName != null) 'Clinic: ${lab.clinicName}',
                  ].where((e) => e.trim().isNotEmpty).toList(),
                ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        KeyedSubtree(
          key: _keys[_Jump.vaccines],
          child: _Section(
            fhir: 'Immunization',
            title: 'Immunizations',
            count: chart.immunizations.length,
            emptyTitle: 'No immunizations recorded',
            emptySubtitle: 'Vaccines given at the clinic appear here.',
            icon: Icons.vaccines_outlined,
            children: [
              for (final i in chart.immunizations)
                _RecordCard(
                  title: i.vaccine ?? 'Vaccine',
                  lines: [
                    if (i.dateAdministered != null)
                      _fmtDate(i.dateAdministered),
                    if (i.lotNumber != null) 'Lot ${i.lotNumber}',
                    if (i.administeredBy != null) 'By ${i.administeredBy}',
                    if (i.clinicName != null) 'Clinic: ${i.clinicName}',
                  ].where((e) => e.isNotEmpty).toList(),
                ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        KeyedSubtree(
          key: _keys[_Jump.plans],
          child: _Section(
            fhir: 'CarePlan',
            title: 'Care plans',
            count: chart.carePlans.length,
            emptyTitle: 'No care plans',
            emptySubtitle: 'Plans written by clinicians appear here.',
            icon: Icons.assignment_outlined,
            children: [
              for (final p in chart.carePlans)
                _RecordCard(
                  title: p.title ?? 'Care plan',
                  lines: [
                    if (p.status != null) p.status!,
                    if (p.goals.isNotEmpty) p.goals.join(', '),
                    if (p.assignedBy != null) 'By ${p.assignedBy}',
                    if (p.clinicName != null) 'Clinic: ${p.clinicName}',
                    if (p.startDate != null) _fmtDate(p.startDate),
                  ].where((e) => e.isNotEmpty).toList(),
                ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        KeyedSubtree(
          key: _keys[_Jump.notes],
          child: _Section(
            fhir: 'OpenEMR notes',
            title: 'Clinical notes',
            count: chart.clinicalNotes.length,
            emptyTitle: 'No clinical notes',
            emptySubtitle: 'Visit notes from clinicians appear here.',
            icon: Icons.notes_outlined,
            children: [
              for (final n in chart.clinicalNotes)
                _RecordCard(
                  title: n.type ?? 'Note',
                  lines: [
                    _fmtDateTime(n.date),
                    if (n.author != null) 'By ${n.author}',
                    if (n.clinicName != null) 'Clinic: ${n.clinicName}',
                    if (n.content != null) n.content!,
                  ].where((e) => e.isNotEmpty && e != '—').toList(),
                ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        KeyedSubtree(
          key: _keys[_Jump.documents],
          child: _Section(
            fhir: 'DocumentReference',
            title: 'Documents',
            count: chart.documents.length,
            emptyTitle: 'No documents',
            emptySubtitle: 'Files attached to your chart appear here.',
            icon: Icons.attach_file_rounded,
            children: [
              for (final d in chart.documents)
                _RecordCard(
                  title: d.fileName ?? d.type ?? 'Document',
                  lines: [
                    if (d.type != null) d.type!,
                    if (d.uploadedBy != null) 'By ${d.uploadedBy}',
                    if (d.status != null) d.status!,
                    if (d.uploadedAt != null) _fmtDate(d.uploadedAt),
                  ].where((e) => e.isNotEmpty).toList(),
                ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _SyncFooter(chart: chart),
      ],
    );
  }
}

class _IdentityCard extends StatelessWidget {
  const _IdentityCard({required this.chart});
  final PatientEmrChart chart;

  @override
  Widget build(BuildContext context) {
    final name =
        chart.patient.fullName.isEmpty ? 'Your chart' : chart.patient.fullName;
    final initials = _initials(chart.patient);
    final meta = [
      if (chart.patient.birthDate != null)
        _fmtDate(chart.patient.birthDate),
      if (chart.patient.gender != null) chart.patient.gender!,
      if (chart.contactInformation.phone != null)
        chart.contactInformation.phone!,
    ].join('  ·  ');

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [
          BoxShadow(
            color: Color(0x140B74FA),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: const Color(0xFF0B74FA),
            child: Text(
              initials,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 18,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: FontHeading.heading4.copyWith(
                    color: AppColors.grayDark,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  meta.isEmpty ? 'Patient · FHIR Patient' : meta,
                  style: FontHeading.bodySmall.copyWith(
                    color: AppColors.CustomgrayDark,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _initials(PatientDemographics p) {
    final a = (p.firstName ?? '').trim();
    final b = (p.lastName ?? '').trim();
    if (a.isEmpty && b.isEmpty) return 'P';
    return '${a.isEmpty ? '' : a[0]}${b.isEmpty ? '' : b[0]}'.toUpperCase();
  }
}

class _PrimaryAction extends StatelessWidget {
  const _PrimaryAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return FilledButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 18),
      label: Text(label),
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.main_background_blue,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
  }
}

class _IconAction extends StatelessWidget {
  const _IconAction({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: SizedBox(
            width: 48,
            height: 48,
            child: Icon(icon, color: AppColors.main_background_blue),
          ),
        ),
      ),
    );
  }
}

class _AllergyBanner extends StatelessWidget {
  const _AllergyBanner({required this.items});
  final List<AllergyRecord> items;

  @override
  Widget build(BuildContext context) {
    final names = items
        .map((a) => a.allergen)
        .whereType<String>()
        .where((e) => e.isNotEmpty)
        .take(4)
        .join(', ');
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF1F2),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.warning_amber_rounded, color: Color(0xFFE11D48)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Critical allergies',
                  style: FontHeading.body.copyWith(
                    color: const Color(0xFF9F1239),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  names.isEmpty ? '${items.length} on file' : names,
                  style: FontHeading.bodySmall.copyWith(
                    color: const Color(0xFF9F1239),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _GlanceRow extends StatelessWidget {
  const _GlanceRow({required this.chart, required this.conditionCount});
  final PatientEmrChart chart;
  final int conditionCount;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _Glance(chart.allergies.length, 'Allergies', const Color(0xFFE11D48)),
        _Glance(chart.medications.length, 'Meds', AppColors.main_background_blue),
        _Glance(conditionCount, 'Problems', const Color(0xFFB45309)),
        _Glance(chart.encounters.length, 'Visits', const Color(0xFF0F766E)),
      ].map((w) => Expanded(child: w)).toList(),
    );
  }
}

class _Glance extends StatelessWidget {
  const _Glance(this.value, this.label, this.color);
  final int value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          children: [
            Text(
              '$value',
              style: TextStyle(
                color: color,
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(
                color: AppColors.CustomgrayDark,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Lean “where my care comes from” strip — unique clinic names already on chart.
class _CareSourcesStrip extends StatelessWidget {
  const _CareSourcesStrip({required this.sources});
  final List<String> sources;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Your care sources',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.grayDark,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            sources.join(' · '),
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.CustomgrayDark,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}

class _JumpChip extends StatelessWidget {
  const _JumpChip(this.label, this.onTap);
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ActionChip(
        label: Text(label, style: const TextStyle(fontSize: 12)),
        backgroundColor: Colors.white,
        side: const BorderSide(color: Color(0xFFE6EBF3)),
        onPressed: onTap,
      ),
    );
  }
}

class _PatientSection extends StatelessWidget {
  const _PatientSection({required this.chart});
  final PatientEmrChart chart;

  @override
  Widget build(BuildContext context) {
    final live = context.watch<EmrCubit>().state.chart ?? chart;
    final p = live.patient;
    final c = live.contactInformation;
    final emergency = live.emergencyContacts;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHead(
          fhir: 'Patient',
          title: 'Patient & contact',
          trailing: TextButton.icon(
            onPressed: () => _openPatientEditor(context, live),
            icon: const Icon(Icons.edit_outlined, size: 16),
            label: const Text('Edit'),
          ),
        ),
        _InfoBlock(
          rows: [
            _InfoRow('Name', p.fullName.isEmpty ? '—' : p.fullName),
            _InfoRow('Birth date', _fmtDate(p.birthDate)),
            _InfoRow('Gender', p.gender ?? '—'),
            _InfoRow('Marital status', p.maritalStatus ?? '—'),
            _InfoRow('Language', p.language ?? '—'),
            _InfoRow('National ID', p.nationalId ?? '—'),
            _InfoRow('Phone', c.phone ?? '—'),
            _InfoRow('Email', c.email ?? '—'),
            _InfoRow(
              'Address',
              c.addressLine.isEmpty ? '—' : c.addressLine,
            ),
          ],
        ),
        const SizedBox(height: 14),
        _SectionHead(
          fhir: 'OpenEMR contact',
          title: 'Emergency contact',
          trailing: TextButton.icon(
            onPressed: () => _openEmergencyEditor(
              context,
              emergency.isEmpty ? null : emergency.first,
            ),
            icon: Icon(
              emergency.isEmpty ? Icons.add : Icons.edit_outlined,
              size: 16,
            ),
            label: Text(emergency.isEmpty ? 'Add' : 'Edit'),
          ),
        ),
        if (emergency.isEmpty)
          const _EmptyCard(
            title: 'None on file',
            subtitle: 'Add a contact the clinic can reach in an emergency.',
          )
        else
          ...emergency.map(
            (e) => _RecordCard(
              title: e.name ?? 'Contact',
              lines: [
                if (e.relationship != null) e.relationship!,
                if (e.phone != null) e.phone!,
                if (e.email != null) e.email!,
              ],
            ),
          ),
        if (emergency.isNotEmpty)
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => _confirmDeleteEmergency(context),
              style: TextButton.styleFrom(foregroundColor: AppColors.red),
              child: const Text('Remove contact'),
            ),
          ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.fhir,
    required this.title,
    required this.count,
    required this.emptyTitle,
    required this.emptySubtitle,
    required this.icon,
    required this.children,
  });

  final String fhir;
  final String title;
  final int count;
  final String emptyTitle;
  final String emptySubtitle;
  final IconData icon;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHead(fhir: fhir, title: '$title ($count)'),
        if (children.isEmpty)
          _EmptyCard(
            icon: icon,
            title: emptyTitle,
            subtitle: emptySubtitle,
          )
        else
          ...[
            for (var i = 0; i < children.length; i++) ...[
              if (i > 0) const SizedBox(height: 10),
              children[i],
            ],
          ],
      ],
    );
  }
}

class _SectionHead extends StatelessWidget {
  const _SectionHead({
    required this.fhir,
    required this.title,
    this.trailing,
  });

  final String fhir;
  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: FontHeading.heading4.copyWith(
                    color: AppColors.grayDark,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  fhir,
                  style: FontHeading.bodySmall.copyWith(
                    color: AppColors.customGray,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({
    required this.title,
    required this.subtitle,
    this.icon,
  });

  final String title;
  final String subtitle;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE8EEF6)),
      ),
      child: Row(
        children: [
          Icon(icon ?? Icons.inbox_outlined, color: AppColors.customGray),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: FontHeading.body.copyWith(
                    color: AppColors.grayDark,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: FontHeading.bodySmall.copyWith(
                    color: AppColors.CustomgrayDark,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RecordCard extends StatelessWidget {
  const _RecordCard({
    required this.title,
    required this.lines,
    this.accent,
  });

  final String title;
  final List<String> lines;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: accent == null
            ? Border.all(color: const Color(0xFFE8EEF6))
            : Border(left: BorderSide(color: accent!, width: 3.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: FontHeading.body.copyWith(
              color: AppColors.grayDark,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (lines.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              lines.join('\n'),
              style: FontHeading.bodySmall.copyWith(
                color: AppColors.CustomgrayDark,
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _InfoBlock extends StatelessWidget {
  const _InfoBlock({required this.rows});
  final List<_InfoRow> rows;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) const Divider(height: 18, color: Color(0xFFF0F3F8)),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 110,
                  child: Text(
                    rows[i].label,
                    style: FontHeading.bodySmall.copyWith(
                      color: AppColors.customGray,
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    rows[i].value,
                    style: FontHeading.body.copyWith(
                      color: AppColors.grayDark,
                      fontSize: 15,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _InfoRow {
  const _InfoRow(this.label, this.value);
  final String label;
  final String value;
}

class _SyncFooter extends StatelessWidget {
  const _SyncFooter({required this.chart});
  final PatientEmrChart chart;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF5FF),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'OpenEMR source',
            style: FontHeading.body.copyWith(
              color: AppColors.main_background_blue,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Status ${chart.syncMetadata.syncStatus.isEmpty ? 'READY' : chart.syncMetadata.syncStatus}'
            ' · Last sync ${_fmtDateTime(chart.syncMetadata.lastSyncAt)}'
            '${chart.syncMetadata.lastVisitDate == null ? '' : ' · Last visit ${_fmtDate(chart.syncMetadata.lastVisitDate)}'}',
            style: FontHeading.bodySmall.copyWith(
              color: AppColors.CustomgrayDark,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'You can edit patient and emergency-contact fields. Clinical lists are written by clinic staff. Visits are paid in cash — no billing in this app.',
            style: FontHeading.bodySmall.copyWith(
              color: AppColors.CustomgrayDark,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}

class _ConditionItem {
  const _ConditionItem(this.title, this.lines);
  final String title;
  final List<String> lines;
}

List<_ConditionItem> _mergedConditions(PatientEmrChart chart) {
  final items = <_ConditionItem>[];
  final seen = <String>{};

  void add({
    required String id,
    String? name,
    String? code,
    String? status,
    String? date,
    String? recordedBy,
    String? clinicName,
  }) {
    final key = id.isNotEmpty ? id : (name ?? '');
    if (key.isEmpty || seen.contains(key)) return;
    seen.add(key);
    items.add(
      _ConditionItem(
        name ?? 'Condition',
        [
          if (code != null) 'ICD-10: $code',
          if (status != null) status,
          if (date != null) 'Diagnosed ${_fmtDate(date)}',
          if (recordedBy != null) 'By $recordedBy',
          if (clinicName != null) 'Clinic: $clinicName',
        ],
      ),
    );
  }

  for (final c in chart.conditions) {
    add(
      id: c.id,
      name: c.name,
      code: c.icd10Code,
      status: c.status,
      date: c.diagnosedDate,
      recordedBy: c.recordedBy,
      clinicName: c.clinicName,
    );
  }
  for (final p in chart.problems) {
    add(
      id: p.id,
      name: p.name,
      code: p.icd10Code,
      status: p.status,
      date: p.diagnosedDate,
      recordedBy: p.recordedBy,
      clinicName: p.clinicName,
    );
  }
  return items;
}

/// Unique clinic names already present on the chart (no extra API).
List<String> _careSources(PatientEmrChart chart) {
  final names = <String>{};

  void add(String? raw) {
    final value = raw?.trim();
    if (value == null || value.isEmpty) return;
    if (value.toLowerCase() == 'clinic') return;
    names.add(value);
  }

  for (final e in chart.encounters) {
    add(e.clinic);
  }
  for (final a in chart.allergies) {
    add(a.clinicName);
  }
  for (final m in chart.medications) {
    add(m.clinicName);
  }
  for (final c in chart.conditions) {
    add(c.clinicName);
  }
  for (final p in chart.problems) {
    add(p.clinicName);
  }
  for (final v in chart.vitalSigns) {
    add(v.clinicName);
  }
  for (final l in chart.labResults) {
    add(l.clinicName);
  }
  for (final plan in chart.carePlans) {
    add(plan.clinicName);
  }
  for (final n in chart.clinicalNotes) {
    add(n.clinicName);
  }
  for (final i in chart.immunizations) {
    add(i.clinicName);
  }

  final list = names.toList()..sort();
  return list;
}

String _fmtDate(String? raw) {
  if (raw == null || raw.isEmpty) return '—';
  final dt = DateTime.tryParse(raw);
  if (dt == null) return raw;
  return DateFormat.yMMMd().format(dt.toLocal());
}

String _fmtDateTime(String? raw) {
  if (raw == null || raw.isEmpty) return '—';
  final dt = DateTime.tryParse(raw);
  if (dt == null) return raw;
  return DateFormat.yMMMd().add_jm().format(dt.toLocal());
}

Future<void> _openPatientEditor(
  BuildContext context,
  PatientEmrChart chart,
) async {
  final cubit = context.read<EmrCubit>();
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (ctx) => BlocProvider.value(
      value: cubit,
      child: _PatientEditSheet(chart: chart),
    ),
  );
  if (result == true && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Patient record saved')),
    );
  }
}

Future<void> _openEmergencyEditor(
  BuildContext context,
  EmergencyContact? existing,
) async {
  final cubit = context.read<EmrCubit>();
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (ctx) => BlocProvider.value(
      value: cubit,
      child: _EmergencyEditSheet(existing: existing),
    ),
  );
  if (result == true && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Emergency contact saved')),
    );
  }
}

Future<void> _confirmDeleteEmergency(BuildContext context) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Remove emergency contact?'),
      content: const Text('This clears the OpenEMR contact on your chart.'),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('Keep'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: const Text('Remove'),
        ),
      ],
    ),
  );
  if (ok != true || !context.mounted) return;
  final saved = await context.read<EmrCubit>().deleteEmergencyContact();
  if (saved && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Emergency contact removed')),
    );
  }
}

class _PatientEditSheet extends StatefulWidget {
  const _PatientEditSheet({required this.chart});
  final PatientEmrChart chart;

  @override
  State<_PatientEditSheet> createState() => _PatientEditSheetState();
}

class _PatientEditSheetState extends State<_PatientEditSheet> {
  late final TextEditingController _first;
  late final TextEditingController _last;
  late final TextEditingController _dob;
  late final TextEditingController _gender;
  late final TextEditingController _phone;
  late final TextEditingController _email;
  late final TextEditingController _address;
  late final TextEditingController _city;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final p = widget.chart.patient;
    final c = widget.chart.contactInformation;
    _first = TextEditingController(text: p.firstName ?? '');
    _last = TextEditingController(text: p.lastName ?? '');
    _dob = TextEditingController(text: p.birthDate ?? '');
    _gender = TextEditingController(text: p.gender ?? '');
    _phone = TextEditingController(text: c.phone ?? '');
    _email = TextEditingController(text: c.email ?? '');
    _address = TextEditingController(text: c.addressLine1 ?? '');
    _city = TextEditingController(text: c.city ?? '');
  }

  @override
  void dispose() {
    _first.dispose();
    _last.dispose();
    _dob.dispose();
    _gender.dispose();
    _phone.dispose();
    _email.dispose();
    _address.dispose();
    _city.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    final cubit = context.read<EmrCubit>();
    final ok = await cubit.updatePortal(
      patient: {
        'firstName': _first.text.trim(),
        'lastName': _last.text.trim(),
        'birthDate': _dob.text.trim(),
        'gender': _gender.text.trim(),
      },
      contactInformation: {
        'phone': _phone.text.trim(),
        'email': _email.text.trim(),
        'addressLine1': _address.text.trim(),
        'city': _city.text.trim(),
      },
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + inset),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Edit patient', style: FontHeading.heading4),
            const SizedBox(height: 4),
            Text(
              'Saved to OpenEMR patient_data',
              style: FontHeading.bodySmall.copyWith(color: AppColors.customGray),
            ),
            const SizedBox(height: 12),
            _field(_first, 'First name'),
            _field(_last, 'Last name'),
            _field(_dob, 'Birth date (YYYY-MM-DD)'),
            _field(_gender, 'Gender'),
            _field(_phone, 'Phone'),
            _field(_email, 'Email'),
            _field(_address, 'Address'),
            _field(_city, 'City'),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _busy ? null : _save,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.main_background_blue,
                foregroundColor: Colors.white,
              ),
              child: Text(
                _busy ? 'Saving…' : 'Save',
                style: FontHeading.button,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmergencyEditSheet extends StatefulWidget {
  const _EmergencyEditSheet({this.existing});
  final EmergencyContact? existing;

  @override
  State<_EmergencyEditSheet> createState() => _EmergencyEditSheetState();
}

class _EmergencyEditSheetState extends State<_EmergencyEditSheet> {
  late final TextEditingController _name;
  late final TextEditingController _relationship;
  late final TextEditingController _phone;
  late final TextEditingController _email;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _name = TextEditingController(text: e?.name ?? '');
    _relationship = TextEditingController(text: e?.relationship ?? '');
    _phone = TextEditingController(text: e?.phone ?? '');
    _email = TextEditingController(text: e?.email ?? '');
  }

  @override
  void dispose() {
    _name.dispose();
    _relationship.dispose();
    _phone.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    final ok = await context.read<EmrCubit>().saveEmergencyContact({
      'name': _name.text.trim(),
      'relationship': _relationship.text.trim(),
      'phone': _phone.text.trim(),
      'email': _email.text.trim(),
    });
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + inset),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.existing == null
                  ? 'Add emergency contact'
                  : 'Edit emergency contact',
              style: FontHeading.heading4,
            ),
            const SizedBox(height: 12),
            _field(_name, 'Name'),
            _field(_relationship, 'Relationship'),
            _field(_phone, 'Phone'),
            _field(_email, 'Email'),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _busy ? null : _save,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.main_background_blue,
                foregroundColor: Colors.white,
              ),
              child: Text(
                _busy ? 'Saving…' : 'Save',
                style: FontHeading.button,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Widget _field(TextEditingController controller, String label) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: TextField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
        isDense: true,
      ),
    ),
  );
}
