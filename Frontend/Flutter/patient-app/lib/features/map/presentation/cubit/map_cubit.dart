import '../../domain/use_cases/map_use_case.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'map_state.dart';

class MapCubit extends Cubit<MapState> {
  final MapUseCase mapUseCase;

  MapCubit({required this.mapUseCase})
      : super(const MapState(status: MapStatus.initial));

  Future<void> fetchData() async {
    emit(state.copyWith(status: MapStatus.loading));

    final result = await mapUseCase.call();

    result.fold(
      (exception) => emit(
        state.copyWith(
          status: MapStatus.error,
          errorMessage: exception.toString(),
        ),
      ),
      (_) => emit(
        state.copyWith(
          status: MapStatus.loaded,
          errorMessage: null,
        ),
      ),
    );
  }
}
