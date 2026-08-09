class FilterState {
  final String? location;
  final String? specialty;
  final double? selectedRating; // 👈 New: null = no rating filter
  final String? sortBy;
  final bool hasChanges;

  const FilterState({
    this.location,
    this.specialty = 'All',
    this.selectedRating,
    this.sortBy = 'Popular',
    this.hasChanges = false,
  });

  FilterState copyWith({
    String? location,
    String? specialty,
    double? selectedRating,
    String? sortBy,
    bool? hasChanges,
  }) {
    return FilterState(
      location: location ?? this.location,
      specialty: specialty ?? this.specialty,
      selectedRating: selectedRating ?? this.selectedRating,
      sortBy: sortBy ?? this.sortBy,
      hasChanges: hasChanges ?? this.hasChanges,
    );
  }
}