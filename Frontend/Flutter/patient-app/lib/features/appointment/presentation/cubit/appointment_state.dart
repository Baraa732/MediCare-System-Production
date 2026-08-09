
enum AppointmentStatus {
  initial,
  loading,
  loaded,
  error,
}

class AppointmentState {
  final AppointmentStatus status;
  final String? errorMessage;

  const AppointmentState({
    required this.status,
    this.errorMessage,
  });

  AppointmentState copyWith({
    AppointmentStatus? status,
    String? errorMessage,
  }) {
    return AppointmentState(
      status: status ?? this.status,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}
