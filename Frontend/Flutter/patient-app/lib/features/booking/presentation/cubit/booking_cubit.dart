// lib/features/booking/presentation/cubit/booking_cubit.dart
import 'package:cms/core/api/api_exception.dart';
import 'package:cms/core/api/services/appointment_api_service.dart';
import 'package:cms/core/api/services/user_api_service.dart';
import 'package:cms/core/entities/appointment.dart';
import 'package:cms/core/storage/session_storage.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'booking_state.dart';

class BookingCubit extends Cubit<BookingState> {
  BookingCubit(
    this._appointmentApi, {
    required UserApiService userApi,
    required SessionStorage sessionStorage,
  })  : _userApi = userApi,
        _sessionStorage = sessionStorage,
        super(const BookingState());

  final AppointmentApiService _appointmentApi;
  final UserApiService _userApi;
  final SessionStorage _sessionStorage;

  Future<void> loadAppointments() async {
    emit(state.copyWith(isLoading: true, errorMessage: null));

    String? patientName = state.patientName;
    String? patientAvatarUrl = state.patientAvatarUrl;
    final userId = _sessionStorage.userId;
    if (userId != null && userId.isNotEmpty) {
      try {
        final profile = await _userApi.getProfile(userId);
        if (profile.fullName.trim().isNotEmpty) {
          patientName = profile.fullName.trim();
        }
        patientAvatarUrl = profile.avatarUrl;
      } catch (_) {}
    }

    try {
      final appointments = await _appointmentApi.getMyAppointments(group: 'all');
      emit(state.copyWith(
        isLoading: false,
        patientName: patientName,
        patientAvatarUrl: patientAvatarUrl,
        allAppointments: appointments,
        filteredAppointments: _filter(appointments, state.selectedStatus),
      ));
    } on ApiException catch (e) {
      emit(state.copyWith(
        isLoading: false,
        patientName: patientName,
        patientAvatarUrl: patientAvatarUrl,
        errorMessage: e.message,
      ));
    } catch (_) {
      emit(state.copyWith(
        isLoading: false,
        patientName: patientName,
        patientAvatarUrl: patientAvatarUrl,
        errorMessage: 'Could not load appointments.',
      ));
    }
  }

  Future<bool> bookAppointment({
    required String clinicId,
    required String doctorId,
    required DateTime scheduledAt,
    int durationMinutes = 30,
    String? reason,
  }) async {
    emit(state.copyWith(errorMessage: null));
    try {
      await _appointmentApi.bookAppointment(
        clinicId: clinicId,
        doctorId: doctorId,
        scheduledAt: scheduledAt,
        durationMinutes: durationMinutes,
        reason: reason,
      );
      // Refresh list in background — do not block success navigation.
      loadAppointments();
      return true;
    } on ApiException catch (e) {
      emit(state.copyWith(errorMessage: e.message));
      return false;
    } catch (_) {
      emit(state.copyWith(
        errorMessage: 'Booking failed. Please try again.',
      ));
      return false;
    }
  }

  Future<void> cancelAppointment(String id, {String? reason}) async {
    try {
      await _appointmentApi.cancelAppointment(id, reason: reason);
      await loadAppointments();
    } on ApiException catch (e) {
      emit(state.copyWith(errorMessage: e.message));
    }
  }

  void selectStatus(String status) {
    emit(state.copyWith(
      selectedStatus: status,
      filteredAppointments: _filter(state.allAppointments, status),
    ));
  }

  List<Appointment> _filter(List<Appointment> all, String status) {
    if (status == 'All') return all;
    return all
        .where((a) => a.status.toLowerCase() == status.toLowerCase())
        .toList();
  }
}
