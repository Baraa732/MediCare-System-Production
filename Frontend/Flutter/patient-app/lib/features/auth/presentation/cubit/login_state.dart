class LoginState {
  final String phoneNumber;
  final String password;
  final String? phoneError;
  final String? passwordError;
  final String? errorMessage;
  final String? mfaToken;
  final bool isValid;
  final bool isLoading;
  final bool shouldNavigateToOtp;
  final bool shouldNavigateToHome;
  final bool isPasswordVisible;

  const LoginState({
    this.phoneNumber = '',
    this.password = '',
    this.phoneError,
    this.passwordError,
    this.errorMessage,
    this.mfaToken,
    this.isValid = false,
    this.isLoading = false,
    this.shouldNavigateToOtp = false,
    this.shouldNavigateToHome = false,
    this.isPasswordVisible = false,
  });

  LoginState copyWith({
    String? phoneNumber,
    String? password,
    String? phoneError,
    String? passwordError,
    String? errorMessage,
    String? mfaToken,
    bool? isValid,
    bool? isLoading,
    bool? shouldNavigateToOtp,
    bool? shouldNavigateToHome,
    bool? isPasswordVisible,
  }) {
    return LoginState(
      phoneNumber: phoneNumber ?? this.phoneNumber,
      password: password ?? this.password,
      phoneError: phoneError,
      passwordError: passwordError,
      errorMessage: errorMessage,
      mfaToken: mfaToken ?? this.mfaToken,
      isValid: isValid ?? this.isValid,
      isLoading: isLoading ?? this.isLoading,
      shouldNavigateToOtp: shouldNavigateToOtp ?? this.shouldNavigateToOtp,
      shouldNavigateToHome: shouldNavigateToHome ?? this.shouldNavigateToHome,
      isPasswordVisible: isPasswordVisible ?? this.isPasswordVisible,
    );
  }
}
