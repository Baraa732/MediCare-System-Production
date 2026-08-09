// lib/features/auth/presentation/cubit/otp_state.dart
class OtpState {
  final String otpCode;
  final bool isValid;
  final bool isLoading;
  final int resendTimer;
  final String? errorMessage;
  final bool shouldNavigateToHome;

  const OtpState({
    this.otpCode = '',
    this.isValid = false,
    this.isLoading = false,
    this.resendTimer = 60,
    this.errorMessage,
    this.shouldNavigateToHome = false,
  });

  OtpState copyWith({
    String? otpCode,
    bool? isValid,
    bool? isLoading,
    int? resendTimer,
    String? errorMessage,
    bool? shouldNavigateToHome,
  }) {
    return OtpState(
      otpCode: otpCode ?? this.otpCode,
      isValid: isValid ?? this.isValid,
      isLoading: isLoading ?? this.isLoading,
      resendTimer: resendTimer ?? this.resendTimer,
      errorMessage: errorMessage,
      shouldNavigateToHome: shouldNavigateToHome ?? this.shouldNavigateToHome,
    );
  }
}
