import '../../domain/use_cases/appointment_use_case.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'appointment_state.dart';

class AppointmentCubit extends Cubit<AppointmentState> {
  final AppointmentUseCase appointmentUseCase;

  AppointmentCubit({required this.appointmentUseCase})
      : super(const AppointmentState(status: AppointmentStatus.initial));

  Future<void> fetchData() async {
    emit(state.copyWith(status: AppointmentStatus.loading));

    final result = await appointmentUseCase.call();

    result.fold(
      (exception) => emit(
        state.copyWith(
          status: AppointmentStatus.error,
          errorMessage: exception.toString(),
        ),
      ),
      (_) => emit(
        state.copyWith(
          status: AppointmentStatus.loaded,
          errorMessage: null,
        ),
      ),
    );
  }
}
