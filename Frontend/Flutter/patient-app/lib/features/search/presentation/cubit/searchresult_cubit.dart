import 'package:cms/core/api/api_exception.dart';
import 'package:cms/core/api/services/clinic_api_service.dart';
import 'package:cms/core/entities/clinic.dart';
import 'package:cms/features/search/presentation/cubit/searchresult_state.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class SearchResultsCubit extends Cubit<SearchResultsState> {
  SearchResultsCubit(this._clinicApi) : super(const SearchResultsState()) {
    prefetchCatalog();
  }

  final ClinicApiService _clinicApi;
  int _requestId = 0;

  Future<void> prefetchCatalog() async {
    if (state.catalog.isNotEmpty || state.isPrefetching) return;
    emit(state.copyWith(isPrefetching: true, clearError: true));
    try {
      final clinics = await _clinicApi.listClinics();
      emit(state.copyWith(isPrefetching: false, catalog: clinics));
      if (state.query.trim().isNotEmpty || state.filters.hasActiveFilters) {
        await search(
          state.query,
          city: state.filters.city,
          specialization: state.filters.specialty,
          governorate: state.filters.governorate,
          sortBy: state.filters.sortBy,
          minRating: state.filters.minRating,
        );
      }
    } catch (_) {
      emit(state.copyWith(isPrefetching: false));
    }
  }

  Future<void> search(
    String query, {
    String? city,
    String? governorate,
    String? specialization,
    String? sortBy,
    double? minRating,
  }) async {
    final filters = SearchFilters(
      city: city?.trim().isEmpty == true ? null : city?.trim(),
      governorate:
          governorate?.trim().isEmpty == true ? null : governorate?.trim(),
      specialty: _normalizeSpecialty(specialization),
      sortBy: sortBy?.trim().isNotEmpty == true ? sortBy!.trim() : 'Popular',
      minRating: minRating,
    );
    final trimmed = query.trim();
    final requestId = ++_requestId;

    // Instant local results while the network call runs.
    final local = _filterLocal(state.catalog, trimmed, filters);
    emit(state.copyWith(
      isLoading: true,
      query: trimmed,
      filters: filters,
      results: local,
      clearError: true,
    ));

    try {
      final remote = await _clinicApi.searchClinics(
        query: trimmed.isEmpty ? null : trimmed,
        city: filters.city,
        governorate: filters.governorate,
        specialization: filters.specialty,
        limit: 50,
      );
      if (requestId != _requestId) return;

      final merged = _mergeById(remote, local);
      final sorted = _sortClinics(merged, filters.sortBy);
      emit(state.copyWith(isLoading: false, results: sorted, clearError: true));
    } on ApiException catch (e) {
      if (requestId != _requestId) return;
      // Keep local results if the API fails — search still works offline-ish.
      emit(state.copyWith(
        isLoading: false,
        results: _sortClinics(local, filters.sortBy),
        errorMessage: local.isEmpty ? e.message : null,
      ));
    } catch (_) {
      if (requestId != _requestId) return;
      emit(state.copyWith(
        isLoading: false,
        results: _sortClinics(local, filters.sortBy),
        errorMessage: local.isEmpty ? 'Search failed. Please try again.' : null,
      ));
    }
  }

  void applyFilters(SearchFilters filters) {
    search(
      state.query,
      city: filters.city,
      governorate: filters.governorate,
      specialization: filters.specialty,
      sortBy: filters.sortBy,
      minRating: filters.minRating,
    );
  }

  void clearResults() {
    _requestId++;
    emit(state.copyWith(
      results: const [],
      query: '',
      isLoading: false,
      clearError: true,
    ));
  }

  String? _normalizeSpecialty(String? value) {
    final trimmed = value?.trim();
    if (trimmed == null || trimmed.isEmpty || trimmed == 'All') return null;
    return trimmed;
  }

  List<Clinic> _filterLocal(
    List<Clinic> source,
    String query,
    SearchFilters filters,
  ) {
    final q = query.toLowerCase();
    Iterable<Clinic> list = source;

    if (q.isNotEmpty) {
      list = list.where((c) {
        final haystack = [
          c.name,
          c.specialty,
          c.location,
          c.city,
          c.governorate,
          c.address,
          c.description,
        ].join(' ').toLowerCase();
        return haystack.contains(q);
      });
    }

    if (filters.city != null && filters.city!.isNotEmpty) {
      final city = filters.city!.toLowerCase();
      list = list.where((c) => c.city.toLowerCase().contains(city));
    }
    if (filters.governorate != null && filters.governorate!.isNotEmpty) {
      final gov = filters.governorate!.toLowerCase();
      list = list.where((c) => c.governorate.toLowerCase().contains(gov));
    }
    if (filters.specialty != null && filters.specialty!.isNotEmpty) {
      final spec = filters.specialty!.toLowerCase();
      list = list.where((c) => c.specialty.toLowerCase().contains(spec));
    }
    if (filters.minRating != null) {
      list = list.where((c) => c.rating >= filters.minRating!);
    }

    return _sortClinics(list.toList(), filters.sortBy);
  }

  List<Clinic> _mergeById(List<Clinic> primary, List<Clinic> secondary) {
    final map = <String, Clinic>{};
    for (final c in secondary) {
      if (c.id.isNotEmpty) map[c.id] = c;
    }
    for (final c in primary) {
      if (c.id.isNotEmpty) map[c.id] = c;
    }
    return map.values.toList();
  }

  List<Clinic> _sortClinics(List<Clinic> clinics, String sortBy) {
    final sorted = [...clinics];
    switch (sortBy) {
      case 'Nearest':
        // Without live GPS sort, keep name order as a stable fallback.
        sorted.sort((a, b) => a.name.compareTo(b.name));
        break;
      case 'Rating':
        sorted.sort((a, b) => b.rating.compareTo(a.rating));
        break;
      case 'Popular':
      default:
        sorted.sort((a, b) {
          final byRating = b.rating.compareTo(a.rating);
          if (byRating != 0) return byRating;
          return a.name.compareTo(b.name);
        });
        break;
    }
    return sorted;
  }
}
