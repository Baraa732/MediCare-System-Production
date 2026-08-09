
enum MapStatus {
  initial,
  loading,
  loaded,
  error,
}

class MapState {
  final MapStatus status;
  final String? errorMessage;

  const MapState({
    required this.status,
    this.errorMessage,
  });

  MapState copyWith({
    MapStatus? status,
    String? errorMessage,
  }) {
    return MapState(
      status: status ?? this.status,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}
