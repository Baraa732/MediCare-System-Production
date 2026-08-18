import 'package:cms/core/entities/patient_emr.dart';

enum EmrLoadStatus { initial, loading, ready, pending, failure }

class EmrState {
  final EmrLoadStatus status;
  final PatientEmrChart? chart;
  final EmrSyncStatus? syncStatus;
  final List<EmrClinicLink> links;
  final String? selectedTenantId;
  final String? errorMessage;
  final bool isSaving;

  const EmrState({
    this.status = EmrLoadStatus.initial,
    this.chart,
    this.syncStatus,
    this.links = const [],
    this.selectedTenantId,
    this.errorMessage,
    this.isSaving = false,
  });

  EmrState copyWith({
    EmrLoadStatus? status,
    PatientEmrChart? chart,
    EmrSyncStatus? syncStatus,
    List<EmrClinicLink>? links,
    String? selectedTenantId,
    String? errorMessage,
    bool? isSaving,
    bool clearError = false,
    bool clearChart = false,
    bool clearSelectedTenant = false,
  }) {
    return EmrState(
      status: status ?? this.status,
      chart: clearChart ? null : (chart ?? this.chart),
      syncStatus: syncStatus ?? this.syncStatus,
      links: links ?? this.links,
      selectedTenantId: clearSelectedTenant
          ? null
          : (selectedTenantId ?? this.selectedTenantId),
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      isSaving: isSaving ?? this.isSaving,
    );
  }
}
