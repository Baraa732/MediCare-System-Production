
enum ClinicStatus {
  initial,
  loading,
  loaded,
  error,
}

class ClinicState {
  final ClinicStatus status;
  final String? errorMessage;

  const ClinicState({
    required this.status,
    this.errorMessage,
  });

  ClinicState copyWith({
    ClinicStatus? status,
    String? errorMessage,
  }) {
    return ClinicState(
      status: status ?? this.status,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}
