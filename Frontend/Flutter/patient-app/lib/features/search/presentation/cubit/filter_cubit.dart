import 'package:flutter_bloc/flutter_bloc.dart';
import 'filter_state.dart';

class FilterCubit extends Cubit<FilterState> {
  FilterCubit() : super(const FilterState());

  void setLocation(String location) {
    emit(state.copyWith(location: location, hasChanges: true));
  }

  void setSpecialty(String specialty) {
    emit(state.copyWith(specialty: specialty, hasChanges: true));
  }

  void setRating(double? rating) {
    emit(state.copyWith(selectedRating: rating, hasChanges: true));
  }

  void setSortBy(String sortBy) {
    emit(state.copyWith(sortBy: sortBy, hasChanges: true));
  }

  void resetFilters() {
    emit(const FilterState());
  }

  void applyFilters() {
    // Emit with hasChanges = false (or navigate back)
    emit(state.copyWith(hasChanges: false));
  }
}