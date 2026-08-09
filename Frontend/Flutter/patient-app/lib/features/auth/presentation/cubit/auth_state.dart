
enum AuthStatus {
  initial,
  loading,
  loaded,
  error,
}

class AuthState {
  final AuthStatus status;
  final String? errorMessage;

  const AuthState({
    required this.status,
    this.errorMessage,
  });

  AuthState copyWith({
    AuthStatus? status,
    String? errorMessage,
  }) {
    return AuthState(
      status: status ?? this.status,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}
