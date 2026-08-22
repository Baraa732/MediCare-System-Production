class ForgotPasswordState {
  final String phoneNumber;
  final String? phoneError;
  final String? errorMessage;
  final bool isLoading;
  final bool shouldNavigateToOtp;

  const ForgotPasswordState({
    this.phoneNumber = '',
    this.phoneError,
    this.errorMessage,
    this.isLoading = false,
    this.shouldNavigateToOtp = false,
  });

  ForgotPasswordState copyWith({
    String? phoneNumber,
    String? phoneError,
    String? errorMessage,
    bool? isLoading,
    bool? shouldNavigateToOtp,
  }) {
    return ForgotPasswordState(
      phoneNumber: phoneNumber ?? this.phoneNumber,
      phoneError: phoneError,
      errorMessage: errorMessage,
      isLoading: isLoading ?? this.isLoading,
      shouldNavigateToOtp: shouldNavigateToOtp ?? this.shouldNavigateToOtp,
    );
  }
}
