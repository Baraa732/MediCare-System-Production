class SearchState {
  final String query;
  final List<String> recentSearches;
  final List<String> popularSearches;
  final bool isLoading;

  const SearchState({
    this.query = '',
    this.recentSearches = const [],
    this.popularSearches = const [],
    this.isLoading = false,
  });

  SearchState copyWith({
    String? query,
    List<String>? recentSearches,
    List<String>? popularSearches,
    bool? isLoading,
  }) {
    return SearchState(
      query: query ?? this.query,
      recentSearches: recentSearches ?? this.recentSearches,
      popularSearches: popularSearches ?? this.popularSearches,
      isLoading: isLoading ?? this.isLoading,
    );
  }
}