import 'package:cms/core/api/services/clinic_api_service.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'search_state.dart';

class SearchCubit extends Cubit<SearchState> {
  SearchCubit(this._clinicApi) : super(const SearchState()) {
    _loadPopularSearches();
  }

  final ClinicApiService _clinicApi;

  void onQueryChanged(String query) {
    emit(state.copyWith(query: query));
  }

  void addRecentSearch(String query) {
    if (query.trim().isEmpty) return;
    final updated = [query, ...state.recentSearches.where((s) => s != query)];
    emit(state.copyWith(
      recentSearches: updated.take(5).toList(),
      query: query,
    ));
  }

  void clearRecentSearches() {
    emit(state.copyWith(recentSearches: []));
  }

  Future<void> _loadPopularSearches() async {
    try {
      final clinics = await _clinicApi.listClinics();
      final terms = <String>{};
      for (final clinic in clinics) {
        if (clinic.name.trim().isNotEmpty) terms.add(clinic.name.trim());
        if (clinic.specialty.trim().isNotEmpty) {
          terms.add(clinic.specialty.trim());
        }
        if (clinic.city.trim().isNotEmpty) terms.add(clinic.city.trim());
      }
      emit(state.copyWith(popularSearches: terms.take(8).toList()));
    } catch (_) {
      emit(state.copyWith(popularSearches: const []));
    }
  }
}
