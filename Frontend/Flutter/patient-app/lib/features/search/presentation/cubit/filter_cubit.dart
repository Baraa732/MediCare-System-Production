import 'package:flutter_bloc/flutter_bloc.dart';
import 'filter_state.dart';

class FilterCubit extends Cubit<FilterState> {
  FilterCubit({FilterState? initial}) : super(initial ?? const FilterState());

  void setLocation(String location) {
    emit(state.copyWith(location: location.trim(), hasChanges: true));
  }

  void setSpecialty(String specialty) {
    emit(state.copyWith(specialty: specialty, hasChanges: true));
  }

  void setRating(double? rating) {
    emit(state.copyWith(
      selectedRating: rating,
      clearRating: rating == null,
      hasChanges: true,
    ));
  }

  void setSortBy(String sortBy) {
    emit(state.copyWith(sortBy: sortBy, hasChanges: true));
  }

  void resetFilters() {
    emit(const FilterState(hasChanges: true));
  }

  FilterState applyFilters() {
    final next = state.copyWith(hasChanges: false);
    emit(next);
    return next;
  }
}
