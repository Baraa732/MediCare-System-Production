import '../../domain/use_cases/clinic_use_case.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'clinic_state.dart';

class ClinicCubit extends Cubit<ClinicState> {
  final ClinicUseCase clinicUseCase;

  ClinicCubit({required this.clinicUseCase})
      : super(const ClinicState(status: ClinicStatus.initial));

  Future<void> fetchData() async {
    emit(state.copyWith(status: ClinicStatus.loading));

    final result = await clinicUseCase.call();

    result.fold(
      (exception) => emit(
        state.copyWith(
          status: ClinicStatus.error,
          errorMessage: exception.toString(),
        ),
      ),
      (_) => emit(
        state.copyWith(
          status: ClinicStatus.loaded,
          errorMessage: null,
        ),
      ),
    );
  }
}
