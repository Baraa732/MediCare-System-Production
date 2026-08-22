// lib/features/auth/presentation/cubit/login_cubit.dart
import 'package:cms/core/api/api_exception.dart';
import 'package:cms/core/api/services/auth_api_service.dart';
import 'package:cms/features/auth/presentation/cubit/login_state.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class LoginCubit extends Cubit<LoginState> {
  LoginCubit(this._authApi) : super(const LoginState());

  final AuthApiService _authApi;

  void onPhoneChanged(String value) {
    final error = _validatePhoneNumber(value);
    final isValid = _validateForm(value, state.password);
    emit(
      state.copyWith(phoneNumber: value, phoneError: error, isValid: isValid),
    );
  }

  String? _validatePhoneNumber(String value) {
    if (value.isEmpty) return 'Phone number is required';
    final cleaned = value.replaceAll(RegExp(r'[^0-9]'), '');
    if (!cleaned.startsWith('09')) return 'Invalid phone number';
    if (cleaned.length != 10) return 'Invalid phone number';
    return null;
  }

  void onPasswordChanged(String value) {
    final error = _validatePassword(value);
    final isValid = _validateForm(state.phoneNumber, value);
    emit(
      state.copyWith(password: value, passwordError: error, isValid: isValid),
    );
  }

  String? _validatePassword(String value) {
    if (value.isEmpty) return 'Password is required';
    if (value.length < 8) return 'Password must be at least 8 characters';
    return null;
  }

  bool _validateForm(String phone, String password) {
    return _validatePhoneNumber(phone) == null &&
        _validatePassword(password) == null &&
        phone.isNotEmpty &&
        password.isNotEmpty;
  }

  void togglePasswordVisibility() {
    emit(state.copyWith(isPasswordVisible: !state.isPasswordVisible));
  }

  Future<void> submitLogin() async {
    if (!state.isValid || state.isLoading) return;
    emit(state.copyWith(isLoading: true, errorMessage: null));

    try {
      final result = await _authApi.login(
        phoneNumber: state.phoneNumber,
        password: state.password,
      );

      if (result.requiresMfa) {
        emit(state.copyWith(
          isLoading: false,
          shouldNavigateToOtp: true,
          mfaToken: result.mfaToken,
        ));
        return;
      }

      if (result.errorCode == 'NOT_PATIENT') {
        emit(state.copyWith(
          isLoading: false,
          errorMessage: 'This app is for patients only.',
        ));
        return;
      }

      emit(state.copyWith(
        isLoading: false,
        shouldNavigateToHome: true,
      ));
    } on ApiException catch (e) {
      emit(state.copyWith(isLoading: false, errorMessage: e.message));
    } catch (_) {
      emit(state.copyWith(
        isLoading: false,
        errorMessage: 'Login failed. Please try again.',
      ));
    }
  }

  void resetNavigation() {
    emit(state.copyWith(
      shouldNavigateToOtp: false,
      shouldNavigateToHome: false,
    ));
  }

  void clearErrors() {
    emit(state.copyWith(
      phoneError: null,
      passwordError: null,
      errorMessage: null,
    ));
  }

  void forgotPassword() {}
}
