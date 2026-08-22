import 'package:cms/core/entities/clinic.dart';

class SearchFilters {
  const SearchFilters({
    this.city,
    this.governorate,
    this.specialty,
    this.sortBy = 'Popular',
    this.minRating,
  });

  final String? city;
  final String? governorate;
  final String? specialty;
  final String sortBy;
  final double? minRating;

  bool get hasActiveFilters {
    final specialtyActive =
        specialty != null && specialty!.trim().isNotEmpty && specialty != 'All';
    return (city?.trim().isNotEmpty ?? false) ||
        (governorate?.trim().isNotEmpty ?? false) ||
        specialtyActive ||
        minRating != null ||
        (sortBy.isNotEmpty && sortBy != 'Popular');
  }

  SearchFilters copyWith({
    String? city,
    String? governorate,
    String? specialty,
    String? sortBy,
    double? minRating,
    bool clearCity = false,
    bool clearGovernorate = false,
    bool clearSpecialty = false,
    bool clearRating = false,
  }) {
    return SearchFilters(
      city: clearCity ? null : (city ?? this.city),
      governorate: clearGovernorate ? null : (governorate ?? this.governorate),
      specialty: clearSpecialty ? null : (specialty ?? this.specialty),
      sortBy: sortBy ?? this.sortBy,
      minRating: clearRating ? null : (minRating ?? this.minRating),
    );
  }

  Map<String, dynamic> toMap() => {
        'city': city,
        'governorate': governorate,
        'specialty': specialty,
        'sortBy': sortBy,
        'minRating': minRating,
      };

  factory SearchFilters.fromMap(Map<String, dynamic>? map) {
    if (map == null) return const SearchFilters();
    return SearchFilters(
      city: map['city']?.toString(),
      governorate: map['governorate']?.toString(),
      specialty: map['specialty']?.toString(),
      sortBy: map['sortBy']?.toString() ?? 'Popular',
      minRating: map['minRating'] is num
          ? (map['minRating'] as num).toDouble()
          : double.tryParse(map['minRating']?.toString() ?? ''),
    );
  }
}

class SearchResultsState {
  final String query;
  final bool isLoading;
  final bool isPrefetching;
  final List<Clinic> results;
  final List<Clinic> catalog;
  final SearchFilters filters;
  final String? errorMessage;

  const SearchResultsState({
    this.query = '',
    this.isLoading = false,
    this.isPrefetching = false,
    this.results = const [],
    this.catalog = const [],
    this.filters = const SearchFilters(),
    this.errorMessage,
  });

  SearchResultsState copyWith({
    String? query,
    bool? isLoading,
    bool? isPrefetching,
    List<Clinic>? results,
    List<Clinic>? catalog,
    SearchFilters? filters,
    String? errorMessage,
    bool clearError = false,
  }) {
    return SearchResultsState(
      query: query ?? this.query,
      isLoading: isLoading ?? this.isLoading,
      isPrefetching: isPrefetching ?? this.isPrefetching,
      results: results ?? this.results,
      catalog: catalog ?? this.catalog,
      filters: filters ?? this.filters,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}
