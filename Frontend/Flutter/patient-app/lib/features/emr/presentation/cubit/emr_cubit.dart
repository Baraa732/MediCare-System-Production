import 'package:cms/core/api/api_exception.dart';
import 'package:cms/core/api/services/emr_api_service.dart';
import 'package:cms/core/entities/patient_emr.dart';
import 'package:cms/features/emr/presentation/cubit/emr_state.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class EmrCubit extends Cubit<EmrState> {
  EmrCubit(this._emrApi) : super(const EmrState());

  final EmrApiService _emrApi;

  Future<void> load({bool showLoading = true, String? tenantId}) async {
    if (showLoading) {
      emit(state.copyWith(status: EmrLoadStatus.loading, clearError: true));
    }

    final preferred = tenantId ?? state.selectedTenantId;

    try {
      List<EmrClinicLink> links = state.links;
      try {
        links = await _emrApi.getMyLinks();
      } catch (_) {
        // Links endpoint may be older on some deploys; chart still works.
      }

      final EmrClinicLink? preferredLink = preferred == null
          ? null
          : links.cast<EmrClinicLink?>().firstWhere(
                (l) => l?.id == preferred,
                orElse: () => null,
              );
      final EmrClinicLink? syncedLink = links.cast<EmrClinicLink?>().firstWhere(
            (l) => l?.synced == true,
            orElse: () => links.isNotEmpty ? links.first : null,
          );
      final selected = preferredLink?.id ?? syncedLink?.id;

      EmrSyncStatus? sync;
      try {
        sync = await _emrApi.getMySyncStatus(tenantId: selected);
      } catch (_) {}

      PatientEmrChart chart;
      try {
        chart = await _emrApi.getMyEmr(tenantId: selected ?? sync?.tenantId);
      } catch (_) {
        chart = PatientEmrChart.empty();
      }

      emit(state.copyWith(
        status: EmrLoadStatus.ready,
        chart: chart,
        syncStatus: sync,
        links: links,
        selectedTenantId: selected ?? sync?.tenantId,
        clearError: true,
      ));
    } catch (_) {
      emit(state.copyWith(
        status: EmrLoadStatus.ready,
        chart: PatientEmrChart.empty(),
        clearError: true,
      ));
    }
  }

  Future<void> selectClinic(String? tenantId) async {
    emit(state.copyWith(selectedTenantId: tenantId));
    await load(tenantId: tenantId);
  }

  Future<bool> updatePortal({
    Map<String, dynamic>? patient,
    Map<String, dynamic>? contactInformation,
    Map<String, dynamic>? emergencyContact,
  }) async {
    emit(state.copyWith(isSaving: true, clearError: true));
    try {
      final chart = await _emrApi.updateMyEmr(
        tenantId: state.selectedTenantId,
        patient: patient,
        contactInformation: contactInformation,
        emergencyContact: emergencyContact,
      );
      emit(state.copyWith(chart: chart, isSaving: false, clearError: true));
      return true;
    } on ApiException catch (e) {
      emit(state.copyWith(isSaving: false, errorMessage: e.message));
      return false;
    } catch (_) {
      emit(state.copyWith(
        isSaving: false,
        errorMessage: 'Could not save your record.',
      ));
      return false;
    }
  }

  Future<bool> saveEmergencyContact(Map<String, dynamic> contact) async {
    emit(state.copyWith(isSaving: true, clearError: true));
    final saved = EmergencyContact(
      name: _nz(contact['name']),
      relationship: _nz(contact['relationship']),
      phone: _nz(contact['phone']),
      email: _nz(contact['email']),
    );
    try {
      var chart = await _emrApi.upsertEmergencyContact(
        tenantId: state.selectedTenantId,
        contact: contact,
      );
      if (chart.emergencyContacts.isEmpty) {
        chart = chart.copyWith(emergencyContacts: [saved]);
      }
      emit(state.copyWith(chart: chart, isSaving: false, clearError: true));
      return true;
    } on ApiException catch (e) {
      emit(state.copyWith(isSaving: false, errorMessage: e.message));
      return false;
    } catch (_) {
      emit(state.copyWith(
        isSaving: false,
        errorMessage: 'Could not save emergency contact.',
      ));
      return false;
    }
  }

  String? _nz(dynamic value) {
    final s = value?.toString().trim();
    if (s == null || s.isEmpty) return null;
    return s;
  }

  Future<bool> deleteEmergencyContact() async {
    emit(state.copyWith(isSaving: true, clearError: true));
    try {
      var chart = await _emrApi.deleteEmergencyContact(
        tenantId: state.selectedTenantId,
      );
      chart = chart.copyWith(emergencyContacts: const []);
      emit(state.copyWith(chart: chart, isSaving: false, clearError: true));
      return true;
    } on ApiException catch (e) {
      emit(state.copyWith(isSaving: false, errorMessage: e.message));
      return false;
    } catch (_) {
      emit(state.copyWith(
        isSaving: false,
        errorMessage: 'Could not remove emergency contact.',
      ));
      return false;
    }
  }
}
