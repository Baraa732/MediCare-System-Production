import 'package:cms/core/api/api_exception.dart';
import 'package:cms/core/api/services/auth_api_service.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'forgot_password_state.dart';

class ForgotPasswordCubit extends Cubit<ForgotPasswordState> {
  ForgotPasswordCubit(this._authApi) : super(const ForgotPasswordState());

  final AuthApiService _authApi;

  void onPhoneChanged(String value) {
    emit(state.copyWith(phoneNumber: value, phoneError: null, errorMessage: null));
  }

  Future<void> sendResetOtp() async {
    final phone = state.phoneNumber.trim();
    if (phone.isEmpty) {
      emit(state.copyWith(phoneError: 'Phone number is required'));
      return;
    }
    emit(state.copyWith(isLoading: true, errorMessage: null, phoneError: null));
    try {
      await _authApi.forgotPasswordSendOtp(phone);
      emit(state.copyWith(isLoading: false, shouldNavigateToOtp: true));
    } on ApiException catch (e) {
      emit(state.copyWith(isLoading: false, errorMessage: e.message));
    } catch (_) {
      emit(state.copyWith(
        isLoading: false,
        errorMessage: 'Could not send reset code. Please try again.',
      ));
    }
  }

  void resetNavigation() {
    emit(state.copyWith(shouldNavigateToOtp: false));
  }
}
