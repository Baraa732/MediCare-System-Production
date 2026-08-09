// lib/features/auth/presentation/cubit/forgot_password_state.dart
class ForgotPasswordState {
  final String phoneNumber;
  final String otpCode;
  final String password;
  final String confirmPassword;
  final String? phoneError;
  final String? passwordError;
  final String? confirmPasswordError;
  final String? errorMessage;
  final bool isValid;
  final bool isLoading;
  final bool otpSent;
  final bool shouldNavigateToHome;
  final bool isPasswordVisible;
  final bool isConfirmPasswordVisible;

  const ForgotPasswordState({
    this.phoneNumber = '',
    this.otpCode = '',
    this.password = '',
    this.confirmPassword = '',
    this.phoneError,
    this.passwordError,
    this.confirmPasswordError,
    this.errorMessage,
    this.isValid = false,
    this.isLoading = false,
    this.otpSent = false,
    this.shouldNavigateToHome = false,
    this.isPasswordVisible = false,
    this.isConfirmPasswordVisible = false,
  });

  ForgotPasswordState copyWith({
    String? phoneNumber,
    String? otpCode,
    String? password,
    String? confirmPassword,
    String? phoneError,
    String? passwordError,
    String? confirmPasswordError,
    String? errorMessage,
    bool? isValid,
    bool? isLoading,
    bool? otpSent,
    bool? shouldNavigateToHome,
    bool? isPasswordVisible,
    bool? isConfirmPasswordVisible,
  }) {
    return ForgotPasswordState(
      phoneNumber: phoneNumber ?? this.phoneNumber,
      otpCode: otpCode ?? this.otpCode,
      password: password ?? this.password,
      confirmPassword: confirmPassword ?? this.confirmPassword,
      phoneError: phoneError,
      passwordError: passwordError,
      confirmPasswordError: confirmPasswordError,
      errorMessage: errorMessage,
      isValid: isValid ?? this.isValid,
      isLoading: isLoading ?? this.isLoading,
      otpSent: otpSent ?? this.otpSent,
      shouldNavigateToHome: shouldNavigateToHome ?? this.shouldNavigateToHome,
      isPasswordVisible: isPasswordVisible ?? this.isPasswordVisible,
      isConfirmPasswordVisible:
          isConfirmPasswordVisible ?? this.isConfirmPasswordVisible,
    );
  }
}
