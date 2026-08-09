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

      final sync = await _emrApi.getMySyncStatus(tenantId: selected);
      if (!sync.synced) {
        emit(state.copyWith(
          status: EmrLoadStatus.pending,
          syncStatus: sync,
          links: links,
          selectedTenantId: selected ?? sync.tenantId,
          clearChart: true,
          clearError: true,
        ));
        return;
      }

      final chart = await _emrApi.getMyEmr(tenantId: selected ?? sync.tenantId);
      emit(state.copyWith(
        status: EmrLoadStatus.ready,
        chart: chart,
        syncStatus: sync,
        links: links,
        selectedTenantId: selected ?? sync.tenantId,
        clearError: true,
      ));
    } on ApiException catch (e) {
      if (e.statusCode == 404) {
        EmrSyncStatus? sync;
        List<EmrClinicLink> links = state.links;
        try {
          sync = await _emrApi.getMySyncStatus(tenantId: preferred);
          links = await _emrApi.getMyLinks();
        } catch (_) {}
        emit(state.copyWith(
          status: EmrLoadStatus.pending,
          syncStatus: sync,
          links: links,
          selectedTenantId: preferred ?? sync?.tenantId,
          clearChart: true,
          clearError: true,
        ));
        return;
      }
      emit(state.copyWith(
        status: EmrLoadStatus.failure,
        errorMessage: e.message,
      ));
    } catch (_) {
      emit(state.copyWith(
        status: EmrLoadStatus.failure,
        errorMessage: 'Could not load your medical records.',
      ));
    }
  }

  Future<void> selectClinic(String? tenantId) async {
    emit(state.copyWith(selectedTenantId: tenantId));
    await load(tenantId: tenantId);
  }
}
