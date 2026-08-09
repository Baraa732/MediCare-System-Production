// lib/features/auth/presentation/cubit/otp_cubit.dart
import 'dart:async';
import 'package:cms/core/api/api_exception.dart';
import 'package:cms/core/api/services/auth_api_service.dart';
import 'package:cms/features/auth/domain/otp_session.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'otp_state.dart';

class OtpCubit extends Cubit<OtpState> {
  OtpCubit({
    required this.session,
    required AuthApiService authApi,
  })  : _authApi = authApi,
        super(const OtpState()) {
    _startTimer();
  }

  final OtpSession session;
  final AuthApiService _authApi;
  Timer? _timer;

  void onOtpChanged(String value) {
    final raw = value.replaceAll(RegExp(r'[^0-9]'), '');
    emit(state.copyWith(
      otpCode: raw,
      isValid: raw.length == 6,
      errorMessage: null,
    ));
  }

  Future<void> verifyOtp() async {
    if (!state.isValid || state.isLoading) return;
    emit(state.copyWith(isLoading: true, errorMessage: null));

    try {
      switch (session.mode) {
        case OtpMode.loginMfa:
          final token = session.mfaToken;
          if (token == null || token.isEmpty) {
            throw ApiException('MFA session expired. Please log in again.');
          }
          await _authApi.verifyMfa(mfaToken: token, otp: state.otpCode);
          break;
        case OtpMode.signupVerify:
        case OtpMode.forgotPassword:
          await _authApi.verifyOtp(
            phoneNumber: session.phoneNumber,
            otp: state.otpCode,
          );
          break;
      }
      emit(state.copyWith(isLoading: false, shouldNavigateToHome: true));
    } on ApiException catch (e) {
      emit(state.copyWith(isLoading: false, errorMessage: e.message));
    } catch (_) {
      emit(state.copyWith(
        isLoading: false,
        errorMessage: 'Verification failed. Please try again.',
      ));
    }
  }

  Future<void> resendCode() async {
    emit(state.copyWith(resendTimer: 60, errorMessage: null));
    _startTimer();
    try {
      if (session.mode == OtpMode.loginMfa && session.mfaToken != null) {
        await _authApi.resendMfaOtp(session.mfaToken!);
      } else {
        await _authApi.resendOtp(session.phoneNumber);
      }
    } on ApiException catch (e) {
      emit(state.copyWith(errorMessage: e.message));
    }
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (state.resendTimer <= 0) {
        timer.cancel();
        return;
      }
      emit(state.copyWith(resendTimer: state.resendTimer - 1));
    });
  }

  void resetNavigation() {
    emit(state.copyWith(shouldNavigateToHome: false));
  }

  @override
  Future<void> close() {
    _timer?.cancel();
    return super.close();
  }
}
