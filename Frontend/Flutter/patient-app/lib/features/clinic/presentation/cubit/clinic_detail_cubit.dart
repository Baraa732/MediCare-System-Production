import 'package:cms/core/api/api_exception.dart';
import 'package:cms/core/api/services/clinic_api_service.dart';
import 'package:cms/core/entities/clinic.dart';
import 'package:cms/core/entities/doctor.dart';
import 'package:cms/core/utils/geocode_service.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'clinic_detail_state.dart';

class ClinicDetailCubit extends Cubit<ClinicDetailState> {
  ClinicDetailCubit(this._clinicApi, this._geocodeService)
      : super(const ClinicDetailState());

  final ClinicApiService _clinicApi;
  final GeocodeService _geocodeService;

  Future<void> load(String clinicId, {Clinic? initialClinic}) async {
    emit(state.copyWith(
      isLoading: true,
      errorMessage: null,
      clinic: initialClinic,
      doctors: const [],
    ));

    // Doctors load in parallel so geocoding never blocks the list.
    final doctorsFuture = _clinicApi.getClinicDoctors(clinicId);

    Clinic? clinic = initialClinic;
    String? error;

    try {
      clinic = await _clinicApi.getClinic(clinicId);
    } on ApiException catch (e) {
      error = e.message;
      clinic = initialClinic ?? state.clinic;
    } catch (_) {
      error = clinic == null ? 'Could not load clinic details.' : null;
      clinic = initialClinic ?? state.clinic;
    }

    if (clinic != null) {
      try {
        clinic = await _ensureCoordinates(clinic);
      } catch (_) {}
    }

    List<Doctor> doctors = const [];
    try {
      doctors = await doctorsFuture;
    } on ApiException catch (e) {
      error ??= e.message;
    } catch (_) {
      error ??= 'Could not load doctors for this clinic.';
    }

    emit(state.copyWith(
      isLoading: false,
      clinic: clinic,
      doctors: doctors,
      errorMessage: error,
    ));
  }

  Future<Clinic> _ensureCoordinates(Clinic clinic) async {
    if (clinic.hasCoordinates) return clinic;

    final query = [
      clinic.address,
      clinic.city,
      clinic.governorate,
      clinic.location,
      clinic.name,
    ].where((part) => part.trim().isNotEmpty).join(', ');

    final coords = await _geocodeService.geocode(query);
    if (coords == null) return clinic;

    return clinic.copyWith(
      latitude: coords.lat,
      longitude: coords.lng,
    );
  }
}
