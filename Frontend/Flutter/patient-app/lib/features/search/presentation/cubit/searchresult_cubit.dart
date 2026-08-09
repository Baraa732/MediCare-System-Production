import 'package:cms/core/api/api_exception.dart';
import 'package:cms/core/api/services/clinic_api_service.dart';
import 'package:cms/features/search/presentation/cubit/searchresult_state.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class SearchResultsCubit extends Cubit<SearchResultsState> {
  SearchResultsCubit(this._clinicApi) : super(const SearchResultsState());

  final ClinicApiService _clinicApi;

  Future<void> search(String query, {String? city, String? specialization}) async {
    emit(state.copyWith(isLoading: true, query: query, errorMessage: null));

    try {
      final results = await _clinicApi.searchClinics(
        query: query,
        city: city,
        specialization: specialization,
      );
      emit(state.copyWith(isLoading: false, results: results));
    } on ApiException catch (e) {
      emit(state.copyWith(isLoading: false, errorMessage: e.message, results: []));
    } catch (_) {
      emit(state.copyWith(
        isLoading: false,
        errorMessage: 'Search failed. Please try again.',
        results: [],
      ));
    }
  }

  void clearResults() {
    emit(state.copyWith(results: [], query: ''));
  }
}
