// lib/features/booking/presentation/cubit/booking_cubit.dart
import 'package:cms/core/api/api_exception.dart';
import 'package:cms/core/api/services/appointment_api_service.dart';
import 'package:cms/core/entities/appointment.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'booking_state.dart';

class BookingCubit extends Cubit<BookingState> {
  BookingCubit(this._appointmentApi) : super(const BookingState());

  final AppointmentApiService _appointmentApi;

  Future<void> loadAppointments() async {
    emit(state.copyWith(isLoading: true, errorMessage: null));
    try {
      final appointments = await _appointmentApi.getMyAppointments(group: 'all');
      emit(state.copyWith(
        isLoading: false,
        allAppointments: appointments,
        filteredAppointments: appointments,
      ));
    } on ApiException catch (e) {
      emit(state.copyWith(isLoading: false, errorMessage: e.message));
    } catch (_) {
      emit(state.copyWith(
        isLoading: false,
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
    emit(state.copyWith(selectedStatus: status));

    if (status == 'All') {
      emit(state.copyWith(filteredAppointments: state.allAppointments));
      return;
    }

    final filtered = state.allAppointments
        .where((appointment) => appointment.status == status)
        .toList();
    emit(state.copyWith(filteredAppointments: filtered));
  }
}
