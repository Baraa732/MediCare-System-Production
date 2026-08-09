// lib/features/auth/presentation/cubit/forgot_password_cubit.dart
import 'package:cms/core/api/api_exception.dart';
import 'package:cms/core/api/services/auth_api_service.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'forgot_password_state.dart';

class ForgotPasswordCubit extends Cubit<ForgotPasswordState> {
  ForgotPasswordCubit(this._authApi) : super(const ForgotPasswordState());

  final AuthApiService _authApi;

  void onPhoneChanged(String value) {
    emit(state.copyWith(phoneNumber: value, phoneError: null));
  }

  void onOtpChanged(String value) {
    emit(state.copyWith(otpCode: value.replaceAll(RegExp(r'[^0-9]'), '')));
  }

  void onPasswordChanged(String value) {
    final error = _validatePassword(value);
    emit(state.copyWith(
      password: value,
      passwordError: error,
      isValid: _validateForm(value, state.confirmPassword, state.otpCode),
    ));
  }

  void onConfirmPasswordChanged(String value) {
    final error = _validateConfirmPassword(state.password, value);
    emit(state.copyWith(
      confirmPassword: value,
      confirmPasswordError: error,
      isValid: _validateForm(state.password, value, state.otpCode),
    ));
  }

  String? _validatePassword(String value) {
    if (value.isEmpty) return 'Password is required';
    if (value.length < 8) return 'Password must be at least 8 characters';
    return null;
  }

  String? _validateConfirmPassword(String password, String confirm) {
    if (confirm.isEmpty) return 'Please confirm your password';
    if (password != confirm) return 'Passwords do not match';
    return null;
  }

  bool _validateForm(String password, String confirm, String otp) {
    return _validatePassword(password) == null &&
        _validateConfirmPassword(password, confirm) == null &&
        otp.length == 6;
  }

  Future<void> sendResetOtp() async {
    if (state.phoneNumber.isEmpty) {
      emit(state.copyWith(phoneError: 'Phone number is required'));
      return;
    }
    emit(state.copyWith(isLoading: true, errorMessage: null));
    try {
      await _authApi.forgotPasswordSendOtp(state.phoneNumber);
      emit(state.copyWith(isLoading: false, otpSent: true));
    } on ApiException catch (e) {
      emit(state.copyWith(isLoading: false, errorMessage: e.message));
    }
  }

  Future<void> submitNewPassword() async {
    if (!state.isValid || state.isLoading) return;
    emit(state.copyWith(isLoading: true, errorMessage: null));
    try {
      await _authApi.resetPassword(
        phoneNumber: state.phoneNumber,
        otp: state.otpCode,
        newPassword: state.password,
      );
      emit(state.copyWith(isLoading: false, shouldNavigateToHome: true));
    } on ApiException catch (e) {
      emit(state.copyWith(isLoading: false, errorMessage: e.message));
    }
  }

  void togglePasswordVisibility() {
    emit(state.copyWith(isPasswordVisible: !state.isPasswordVisible));
  }

  void toggleConfirmPasswordVisibility() {
    emit(state.copyWith(isConfirmPasswordVisible: !state.isConfirmPasswordVisible));
  }

  void resetNavigation() {
    emit(state.copyWith(shouldNavigateToHome: false));
  }

  void clearErrors() {
    emit(state.copyWith(
      passwordError: null,
      confirmPasswordError: null,
      errorMessage: null,
    ));
  }
}
