import 'package:cms/core/entities/clinic.dart';

class SearchResultsState {
  final String query;
  final bool isLoading;
  final List<Clinic> results;
  final String? errorMessage;

  const SearchResultsState({
    this.query = '',
    this.isLoading = false,
    this.results = const [],
    this.errorMessage,
  });

  SearchResultsState copyWith({
    String? query,
    bool? isLoading,
    List<Clinic>? results,
    String? errorMessage,
  }) {
    return SearchResultsState(
      query: query ?? this.query,
      isLoading: isLoading ?? this.isLoading,
      results: results ?? this.results,
      errorMessage: errorMessage,
    );
  }
}