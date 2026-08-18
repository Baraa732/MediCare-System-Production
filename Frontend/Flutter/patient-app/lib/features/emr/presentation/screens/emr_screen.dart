import 'package:cms/core/animations/fade_slide_in.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/entities/patient_emr.dart';
import 'package:cms/core/theme/app_colors.dart';
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

class _EmrView extends StatelessWidget {
  const _EmrView();

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FB),
      body: Column(
        children: [
          _Header(topInset: top),
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
                    return const Center(child: CircularProgressIndicator());
                  case EmrLoadStatus.pending:
                  case EmrLoadStatus.failure:
                    return FadeSlideIn(
                      child: RefreshIndicator(
                        color: AppColors.main_background_blue,
                        onRefresh: () =>
                            context.read<EmrCubit>().load(showLoading: false),
                        child: _ChartBody(
                          chart: state.chart ?? PatientEmrChart.empty(),
                        ),
                      ),
                    );
                  case EmrLoadStatus.ready:
                    final chart = state.chart!;
                    return FadeSlideIn(
                      child: Column(
                        children: [
                          if (state.links.length > 1)
                            _ClinicPicker(
                              links: state.links,
                              selectedTenantId: state.selectedTenantId,
                            ),
                          if (state.isSaving)
                            const LinearProgressIndicator(minHeight: 2),
                          Expanded(
                            child: RefreshIndicator(
                              color: AppColors.main_background_blue,
                              onRefresh: () => context
                                  .read<EmrCubit>()
                                  .load(showLoading: false),
                              child: _ChartBody(chart: chart),
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
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.topInset});

  final double topInset;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(8, topInset + 8, 16, 20),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0B74FA), Color(0xFF0856C0)],
        ),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.arrow_back_ios_new_rounded,
                color: Colors.white, size: 20),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'My Health Record',
                  style: FontHeading.heading3.copyWith(color: Colors.white),
                ),
                const SizedBox(height: 2),
                Text(
                  'OpenEMR chart · cash at the clinic',
                  style: FontHeading.bodySmall.copyWith(
                    color: Colors.white.withValues(alpha: 0.85),
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => context.read<EmrCubit>().load(),
            icon: const Icon(Icons.refresh_rounded, color: Colors.white),
            tooltip: 'Refresh',
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
                        ),
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
    final id = link.id ?? 'clinic';
    final short = id.length > 8 ? id.substring(0, 8) : id;
    final status = link.synced ? 'synced' : link.syncStatus.toLowerCase();
    return 'Clinic $short · $status';
  }
}

class _ChartBody extends StatelessWidget {
  const _ChartBody({required this.chart});

  final PatientEmrChart chart;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 8,
      child: Column(
        children: [
          Material(
            color: Colors.white,
            child: TabBar(
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              labelColor: AppColors.main_background_blue,
              unselectedLabelColor: AppColors.CustomgrayDark,
              indicatorColor: AppColors.main_background_blue,
              labelStyle: FontHeading.bodySmall.copyWith(
                fontWeight: FontWeight.w600,
                color: AppColors.main_background_blue,
              ),
              tabs: [
                Tab(text: 'Overview'),
                Tab(text: 'Allergies (${chart.allergies.length})'),
                Tab(text: 'Medications (${chart.medications.length})'),
                Tab(text: 'Conditions (${_conditionCount(chart)})'),
                Tab(text: 'Visits (${chart.encounters.length})'),
                Tab(text: 'Vitals (${chart.vitalSigns.length})'),
                Tab(text: 'Labs (${chart.labResults.length})'),
                Tab(text: 'More'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                _OverviewTab(chart: chart),
                _AllergiesTab(items: chart.allergies),
                _MedicationsTab(items: chart.medications),
                _ConditionsTab(chart: chart),
                _EncountersTab(items: chart.encounters),
                _VitalsTab(items: chart.vitalSigns),
                _LabsTab(items: chart.labResults),
                _MoreTab(chart: chart),
              ],
            ),
          ),
        ],
      ),
    );
  }

  int _conditionCount(PatientEmrChart chart) {
    final ids = <String>{};
    for (final c in chart.conditions) {
      ids.add(c.id.isEmpty ? c.name ?? '' : c.id);
    }
    for (final p in chart.problems) {
      ids.add(p.id.isEmpty ? p.name ?? '' : p.id);
    }
    return ids.where((e) => e.isNotEmpty).length;
  }
}

class _OverviewTab extends StatelessWidget {
  const _OverviewTab({required this.chart});

  final PatientEmrChart chart;

  @override
  Widget build(BuildContext context) {
    final patient = chart.patient;
    final contact = chart.contactInformation;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        Row(
          children: [
            const Expanded(child: _SectionTitle('Patient')),
            TextButton.icon(
              onPressed: () => _openPatientEditor(context, chart),
              icon: const Icon(Icons.edit_outlined, size: 16),
              label: const Text('Edit'),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.main_background_blue,
              ),
            ),
          ],
        ),
        _InfoBlock(
          rows: [
            _InfoRow('Name', patient.fullName.isEmpty ? '—' : patient.fullName),
            _InfoRow('Birth date', _fmtDate(patient.birthDate)),
            _InfoRow('Gender', patient.gender ?? '—'),
            if (patient.nationalId != null)
              _InfoRow('National ID', patient.nationalId!),
            if (contact.phone != null) _InfoRow('Phone', contact.phone!),
            if (contact.email != null) _InfoRow('Email', contact.email!),
            if (contact.addressLine.isNotEmpty)
              _InfoRow('Address', contact.addressLine),
          ],
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            const Expanded(child: _SectionTitle('Emergency contact')),
            TextButton.icon(
              onPressed: () => _openEmergencyEditor(
                context,
                chart.emergencyContacts.isEmpty
                    ? null
                    : chart.emergencyContacts.first,
              ),
              icon: Icon(
                chart.emergencyContacts.isEmpty
                    ? Icons.add
                    : Icons.edit_outlined,
                size: 16,
              ),
              label: Text(chart.emergencyContacts.isEmpty ? 'Add' : 'Edit'),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.main_background_blue,
              ),
            ),
          ],
        ),
        if (chart.emergencyContacts.isEmpty)
          const _InlineEmpty('None on file — add one for the clinic')
        else
          ...chart.emergencyContacts.map(
            (c) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _LineTile(
                title: c.name ?? 'Contact',
                subtitle: [
                  if (c.relationship != null) c.relationship!,
                  if (c.phone != null) c.phone!,
                  if (c.email != null) c.email!,
                ].where((e) => e.isNotEmpty).join(' · '),
              ),
            ),
          ),
        if (chart.emergencyContacts.isNotEmpty)
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => _confirmDeleteEmergency(context),
              style: TextButton.styleFrom(foregroundColor: AppColors.red),
              child: const Text('Remove contact'),
            ),
          ),
        const SizedBox(height: 20),
        _SectionTitle('At a glance'),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            _StatChip(
              label: 'Allergies',
              value: '${chart.allergies.length}',
              color: const Color(0xFFE11D48),
            ),
            _StatChip(
              label: 'Medications',
              value: '${chart.medications.length}',
              color: AppColors.main_background_blue,
            ),
            _StatChip(
              label: 'Conditions',
              value: '${chart.conditions.length}',
              color: const Color(0xFFB45309),
            ),
            _StatChip(
              label: 'Visits',
              value: '${chart.encounters.length}',
              color: const Color(0xFF0F766E),
            ),
            _StatChip(
              label: 'Labs',
              value: '${chart.labResults.length}',
              color: const Color(0xFF7C3AED),
            ),
            _StatChip(
              label: 'Vaccines',
              value: '${chart.immunizations.length}',
              color: AppColors.green,
            ),
          ],
        ),
        if (chart.allergies.isNotEmpty) ...[
          const SizedBox(height: 20),
          _SectionTitle('Critical allergies'),
          ...chart.allergies.take(3).map(
                (a) => _LineTile(
                  title: a.allergen ?? 'Unknown allergen',
                  subtitle: [
                    if (a.severity != null) a.severity!,
                    if (a.reaction != null) a.reaction!,
                  ].join(' · '),
                  accent: const Color(0xFFE11D48),
                ),
              ),
        ],
        if (chart.medications.isNotEmpty) ...[
          const SizedBox(height: 20),
          _SectionTitle('Active medications'),
          ...chart.medications.take(4).map(
                (m) => _LineTile(
                  title: m.name ?? 'Medication',
                  subtitle: [
                    if (m.dosage != null) m.dosage!,
                    if (m.frequency != null) m.frequency!,
                    if (m.status != null) m.status!,
                  ].join(' · '),
                ),
              ),
        ],
        const SizedBox(height: 20),
        _SectionTitle('Sync'),
        _InfoBlock(
          rows: [
            _InfoRow('Status', chart.syncMetadata.syncStatus),
            _InfoRow('Last sync', _fmtDateTime(chart.syncMetadata.lastSyncAt)),
            if (chart.syncMetadata.lastVisitDate != null)
              _InfoRow(
                'Last visit',
                _fmtDate(chart.syncMetadata.lastVisitDate),
              ),
          ],
        ),
      ],
    );
  }
}

class _AllergiesTab extends StatelessWidget {
  const _AllergiesTab({required this.items});
  final List<AllergyRecord> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const _EmptyList(
        icon: Icons.warning_amber_rounded,
        title: 'No allergies on file',
        subtitle: 'Clinic staff will add allergies when known',
      );
    }
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (_, i) {
        final a = items[i];
        return _LineTile(
          title: a.allergen ?? 'Allergy',
          subtitle: [
            if (a.severity != null) 'Severity: ${a.severity}',
            if (a.reaction != null) 'Reaction: ${a.reaction}',
            if (a.recordedDate != null) 'Recorded ${_fmtDate(a.recordedDate)}',
          ].join('\n'),
          accent: const Color(0xFFE11D48),
        );
      },
    );
  }
}

class _MedicationsTab extends StatelessWidget {
  const _MedicationsTab({required this.items});
  final List<MedicationRecord> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const _EmptyList(
        icon: Icons.medication_outlined,
        title: 'No medications',
        subtitle: 'Prescriptions from your visits will appear here',
      );
    }
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (_, i) {
        final m = items[i];
        return _LineTile(
          title: m.name ?? 'Medication',
          subtitle: [
            if (m.dosage != null || m.frequency != null)
              [m.dosage, m.frequency].whereType<String>().join(' · '),
            if (m.route != null) 'Route: ${m.route}',
            if (m.prescribedBy != null) 'Prescribed by ${m.prescribedBy}',
            if (m.startDate != null) 'Started ${_fmtDate(m.startDate)}',
            if (m.status != null) m.status!,
          ].where((e) => e.isNotEmpty).join('\n'),
        );
      },
    );
  }
}

class _ConditionsTab extends StatelessWidget {
  const _ConditionsTab({required this.chart});
  final PatientEmrChart chart;

  @override
  Widget build(BuildContext context) {
    final items = <({String title, String subtitle})>[];
    final seen = <String>{};

    void add(String id, String? name, String? code, String? status, String? date) {
      final key = id.isNotEmpty ? id : (name ?? '');
      if (key.isEmpty || seen.contains(key)) return;
      seen.add(key);
      items.add((
        title: name ?? 'Condition',
        subtitle: [
          if (code != null) 'ICD-10: $code',
          if (status != null) status,
          if (date != null) 'Diagnosed ${_fmtDate(date)}',
        ].join(' · '),
      ));
    }

    for (final c in chart.conditions) {
      add(c.id, c.name, c.icd10Code, c.status, c.diagnosedDate);
    }
    for (final p in chart.problems) {
      add(p.id, p.name, p.icd10Code, p.status, p.diagnosedDate);
    }

    if (items.isEmpty) {
      return const _EmptyList(
        icon: Icons.health_and_safety_outlined,
        title: 'No conditions listed',
        subtitle: 'Diagnoses and problems will show after visits',
      );
    }

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (_, i) => _LineTile(
        title: items[i].title,
        subtitle: items[i].subtitle,
      ),
    );
  }
}

class _EncountersTab extends StatelessWidget {
  const _EncountersTab({required this.items});
  final List<EncounterRecord> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const _EmptyList(
        icon: Icons.event_note_outlined,
        title: 'No visits yet',
        subtitle: 'Completed clinic encounters appear here',
      );
    }
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (_, i) {
        final e = items[i];
        return _LineTile(
          title: e.type ?? e.reason ?? 'Visit',
          subtitle: [
            _fmtDateTime(e.date),
            if (e.clinic != null) e.clinic!,
            if (e.provider != null) 'Provider: ${e.provider}',
            if (e.reason != null && e.type != null) e.reason!,
            if (e.diagnosis.isNotEmpty) 'Dx: ${e.diagnosis.join(', ')}',
            if (e.notes != null) e.notes!,
          ].where((s) => s.isNotEmpty && s != '—').join('\n'),
        );
      },
    );
  }
}

class _VitalsTab extends StatelessWidget {
  const _VitalsTab({required this.items});
  final List<VitalSignRecord> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const _EmptyList(
        icon: Icons.monitor_heart_outlined,
        title: 'No vital signs',
        subtitle: 'Vitals recorded during visits will appear here',
      );
    }
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (_, i) {
        final v = items[i];
        final parts = <String>[
          if (v.bloodPressure != null) 'BP ${v.bloodPressure}',
          if (v.heartRate != null) 'HR ${v.heartRate!.toStringAsFixed(0)} bpm',
          if (v.temperatureCelsius != null)
            'Temp ${v.temperatureCelsius!.toStringAsFixed(1)}°C',
          if (v.oxygenSaturation != null)
            'SpO₂ ${v.oxygenSaturation!.toStringAsFixed(0)}%',
          if (v.weightKg != null) 'Wt ${v.weightKg!.toStringAsFixed(1)} kg',
          if (v.heightCm != null) 'Ht ${v.heightCm!.toStringAsFixed(0)} cm',
          if (v.bmi != null) 'BMI ${v.bmi!.toStringAsFixed(1)}',
          if (v.respiratoryRate != null)
            'RR ${v.respiratoryRate!.toStringAsFixed(0)}',
        ];
        return _LineTile(
          title: _fmtDateTime(v.date),
          subtitle: parts.isEmpty ? 'No measurements' : parts.join(' · '),
        );
      },
    );
  }
}

class _LabsTab extends StatelessWidget {
  const _LabsTab({required this.items});
  final List<LabResultRecord> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const _EmptyList(
        icon: Icons.science_outlined,
        title: 'No lab results',
        subtitle: 'Laboratory results will appear when available',
      );
    }
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (_, i) {
        final lab = items[i];
        final result = [
          lab.result,
          if (lab.unit != null) lab.unit,
        ].whereType<String>().join(' ');
        return _LineTile(
          title: lab.testName ?? 'Lab test',
          subtitle: [
            if (result.isNotEmpty) result,
            if (lab.referenceRange != null) 'Ref: ${lab.referenceRange}',
            if (lab.status != null) lab.status!,
            if (lab.performedDate != null)
              _fmtDate(lab.performedDate),
          ].where((e) => e.isNotEmpty).join('\n'),
        );
      },
    );
  }
}

class _MoreTab extends StatelessWidget {
  const _MoreTab({required this.chart});
  final PatientEmrChart chart;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        _SectionTitle('Immunizations (${chart.immunizations.length})'),
        if (chart.immunizations.isEmpty)
          const _InlineEmpty('No immunizations recorded')
        else
          ...chart.immunizations.map(
            (i) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _LineTile(
                title: i.vaccine ?? 'Vaccine',
                subtitle: [
                  if (i.dateAdministered != null)
                    _fmtDate(i.dateAdministered),
                  if (i.lotNumber != null) 'Lot ${i.lotNumber}',
                  if (i.administeredBy != null) i.administeredBy!,
                ].where((e) => e.isNotEmpty).join(' · '),
              ),
            ),
          ),
        const SizedBox(height: 12),
        _SectionTitle('Care plans (${chart.carePlans.length})'),
        if (chart.carePlans.isEmpty)
          const _InlineEmpty('No care plans')
        else
          ...chart.carePlans.map(
            (p) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _LineTile(
                title: p.title ?? 'Care plan',
                subtitle: [
                  if (p.status != null) p.status!,
                  if (p.goals.isNotEmpty) p.goals.join(', '),
                  if (p.startDate != null) _fmtDate(p.startDate),
                ].where((e) => e.isNotEmpty).join('\n'),
              ),
            ),
          ),
        const SizedBox(height: 12),
        _SectionTitle('Clinical notes (${chart.clinicalNotes.length})'),
        if (chart.clinicalNotes.isEmpty)
          const _InlineEmpty('No clinical notes')
        else
          ...chart.clinicalNotes.map(
            (n) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _LineTile(
                title: n.type ?? 'Note',
                subtitle: [
                  _fmtDateTime(n.date),
                  if (n.author != null) n.author!,
                  if (n.content != null) n.content!,
                ].where((e) => e.isNotEmpty && e != '—').join('\n'),
              ),
            ),
          ),
        const SizedBox(height: 12),
        _SectionTitle('Documents (${chart.documents.length})'),
        if (chart.documents.isEmpty)
          const _InlineEmpty('No documents')
        else
          ...chart.documents.map(
            (d) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _LineTile(
                title: d.fileName ?? d.type ?? 'Document',
                subtitle: [
                  if (d.type != null) d.type!,
                  if (d.status != null) d.status!,
                  if (d.uploadedAt != null) _fmtDate(d.uploadedAt),
                ].where((e) => e.isNotEmpty).join(' · '),
              ),
            ),
          ),
        if (chart.emergencyContacts.isNotEmpty) ...[
          const SizedBox(height: 12),
          _SectionTitle('Emergency contacts'),
          ...chart.emergencyContacts.map(
            (c) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _LineTile(
                title: c.name ?? 'Contact',
                subtitle: [
                  if (c.relationship != null) c.relationship!,
                  if (c.phone != null) c.phone!,
                  if (c.email != null) c.email!,
                ].where((e) => e.isNotEmpty).join(' · '),
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        Text(
          'Structured OpenEMR chart (Patient, AllergyIntolerance, MedicationRequest, Condition, Encounter, Observation). You can edit your patient and emergency-contact fields. Visits are paid in cash at reception — no billing in this app.',
          style: FontHeading.bodySmall.copyWith(color: AppColors.customGray),
        ),
      ],
    );
  }
}

class _EmptyList extends StatelessWidget {
  const _EmptyList({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(
          height: MediaQuery.sizeOf(context).height * 0.45,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 40, color: AppColors.customGray),
              const SizedBox(height: 12),
              Text(title, style: FontHeading.heading4.copyWith(color: AppColors.grayDark)),
              const SizedBox(height: 6),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text(
                  subtitle,
                  textAlign: TextAlign.center,
                  style: FontHeading.bodySmall.copyWith(color: AppColors.customGray),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _InlineEmpty extends StatelessWidget {
  const _InlineEmpty(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        text,
        style: FontHeading.bodySmall.copyWith(color: AppColors.customGray),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(
        text,
        style: FontHeading.heading4.copyWith(color: AppColors.grayDark),
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 104,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: FontHeading.heading3.copyWith(color: color, fontSize: 22),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: FontHeading.bodySmall.copyWith(
              color: AppColors.CustomgrayDark,
              fontSize: 12,
            ),
          ),
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
            if (i > 0) const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 96,
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

class _LineTile extends StatelessWidget {
  const _LineTile({
    required this.title,
    required this.subtitle,
    this.accent,
  });

  final String title;
  final String subtitle;
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
            ? null
            : Border(left: BorderSide(color: accent!, width: 3)),
      ),
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
          if (subtitle.trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              subtitle,
              style: FontHeading.bodySmall.copyWith(
                color: AppColors.CustomgrayDark,
                height: 1.35,
              ),
            ),
          ],
        ],
      ),
    );
  }
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
              'OpenEMR Standard API patient fields',
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
              ),
              child: Text(_busy ? 'Saving…' : 'Save'),
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
              ),
              child: Text(_busy ? 'Saving…' : 'Save'),
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
