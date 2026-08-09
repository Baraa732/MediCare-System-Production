import 'dart:io';

import 'package:cms/core/api/api_exception.dart';
import 'package:cms/core/api/services/auth_api_service.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'signup_state.dart';

class SignupCubit extends Cubit<SignupState> {
  SignupCubit(this._authApi) : super(const SignupState());

  final AuthApiService _authApi;

  void onFirstNameChanged(String value) {
    emit(state.copyWith(
      firstName: value,
      firstNameError: _validateFirstName(value),
    ));
  }

  void onLastNameChanged(String value) {
    emit(state.copyWith(
      lastName: value,
      lastNameError: _validateLastName(value),
    ));
  }

  void onGenderChanged(String value) {
    emit(state.copyWith(
      gender: value,
      genderError: value.isEmpty ? 'Please select your gender' : null,
    ));
  }

  void onDateOfBirthChanged(DateTime date) {
    emit(state.copyWith(
      dateOfBirth: date,
      dobError: _validateDateOfBirth(date),
    ));
  }

  void clearDateOfBirth() {
    emit(state.copyWith(
      clearDateOfBirth: true,
      dobError: 'Date of birth is required',
    ));
  }

  void onPhoneChanged(String value) {
    emit(state.copyWith(
      phoneNumber: value,
      phoneError: _validatePhone(value),
    ));
  }

  void onEmailChanged(String value) {
    emit(state.copyWith(
      email: value,
      emailError: _validateEmail(value),
    ));
  }

  void onGovernorateChanged(String? value) {
    emit(state.copyWith(governorate: value ?? ''));
  }

  void onPasswordChanged(String value) {
    emit(state.copyWith(
      password: value,
      passwordError: _validatePassword(value),
      confirmPasswordError: state.confirmPassword.isNotEmpty
          ? _validateConfirmPassword(value, state.confirmPassword)
          : null,
    ));
  }

  void onConfirmPasswordChanged(String value) {
    emit(state.copyWith(
      confirmPassword: value,
      confirmPasswordError: _validateConfirmPassword(state.password, value),
    ));
  }

  void onTermsChanged(bool value) {
    emit(state.copyWith(
      acceptedTerms: value,
      termsError: value ? null : 'You must accept the terms to continue',
    ));
  }

  void togglePasswordVisibility() {
    emit(state.copyWith(isPasswordVisible: !state.isPasswordVisible));
  }

  void toggleConfirmPasswordVisibility() {
    emit(state.copyWith(
      isConfirmPasswordVisible: !state.isConfirmPasswordVisible,
    ));
  }

  bool goToNextStep() {
    if (!_validateCurrentStep(showErrors: true)) return false;

    switch (state.currentStep) {
      case SignupStep.personal:
        emit(state.copyWith(currentStep: SignupStep.contact));
        return true;
      case SignupStep.contact:
        emit(state.copyWith(currentStep: SignupStep.security));
        return true;
      case SignupStep.security:
        return false;
    }
  }

  void goToPreviousStep() {
    switch (state.currentStep) {
      case SignupStep.personal:
        break;
      case SignupStep.contact:
        emit(state.copyWith(currentStep: SignupStep.personal));
        break;
      case SignupStep.security:
        emit(state.copyWith(currentStep: SignupStep.contact));
        break;
    }
  }

  bool _validateCurrentStep({required bool showErrors}) {
    switch (state.currentStep) {
      case SignupStep.personal:
        if (!showErrors) return state.isPersonalStepValid;
        emit(state.copyWith(
          firstNameError: _validateFirstName(state.firstName),
          lastNameError: _validateLastName(state.lastName),
          genderError:
              state.gender.isEmpty ? 'Please select your gender' : null,
          dobError: _validateDateOfBirth(state.dateOfBirth),
        ));
        return state.isPersonalStepValid;
      case SignupStep.contact:
        if (!showErrors) return state.isContactStepValid;
        emit(state.copyWith(
          phoneError: _validatePhone(state.phoneNumber),
          emailError: _validateEmail(state.email),
        ));
        return state.isContactStepValid;
      case SignupStep.security:
        if (!showErrors) return state.isSecurityStepValid;
        emit(state.copyWith(
          passwordError: _validatePassword(state.password),
          confirmPasswordError:
              _validateConfirmPassword(state.password, state.confirmPassword),
          termsError: state.acceptedTerms
              ? null
              : 'You must accept the terms to continue',
        ));
        return state.isSecurityStepValid;
    }
  }

  Future<void> submitSignup() async {
    if (!_validateCurrentStep(showErrors: true) || state.isLoading) return;
    if (!state.isSecurityStepValid) return;

    emit(state.copyWith(isLoading: true, errorMessage: null));

    try {
      await _authApi.registerPatient(
        phoneNumber: state.phoneNumber,
        firstName: state.firstName.trim(),
        lastName: state.lastName.trim(),
        password: state.password,
        email: state.email.trim().isEmpty ? null : state.email.trim(),
        gender: _mapGender(state.gender),
        birthDate: state.dateOfBirth?.toIso8601String().split('T').first,
        governorate:
            state.governorate.isEmpty ? null : state.governorate,
      );
      emit(state.copyWith(isLoading: false, shouldNavigateToOtp: true));
    } on ApiException catch (e) {
      emit(state.copyWith(isLoading: false, errorMessage: e.message));
    } catch (_) {
      emit(state.copyWith(
        isLoading: false,
        errorMessage: 'Registration failed. Please try again.',
      ));
    }
  }

  void resetNavigation() {
    emit(state.copyWith(shouldNavigateToOtp: false, errorMessage: null));
  }

  Future<void> pickProfileImage() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 300,
      maxHeight: 300,
      imageQuality: 80,
    );
    if (pickedFile != null) {
      emit(state.copyWith(profileImage: File(pickedFile.path)));
    }
  }

  void removeProfileImage() {
    emit(state.copyWith(clearProfileImage: true));
  }

  String? _validateFirstName(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return 'First name is required';
    if (trimmed.length < 2) return 'First name is too short';
    return null;
  }

  String? _validateLastName(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return 'Last name is required';
    if (trimmed.length < 2) return 'Last name is too short';
    return null;
  }

  String? _validateDateOfBirth(DateTime? date) {
    if (date == null) return 'Date of birth is required';
    final now = DateTime.now();
    final age = now.year - date.year -
        ((now.month < date.month ||
                (now.month == date.month && now.day < date.day))
            ? 1
            : 0);
    if (age < 13) return 'You must be at least 13 years old';
    if (age > 120) return 'Please enter a valid date of birth';
    return null;
  }

  String? _validatePhone(String value) {
    final cleaned = value.replaceAll(RegExp(r'[^0-9]'), '');
    if (cleaned.isEmpty) return 'Phone number is required';
    if (!cleaned.startsWith('09')) return 'Must start with 09';
    if (cleaned.length != 10) return 'Must be exactly 10 digits';
    return null;
  }

  String? _validateEmail(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return null;
    final emailRegex = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,}$');
    if (!emailRegex.hasMatch(trimmed)) return 'Enter a valid email address';
    return null;
  }

  String? _validatePassword(String value) {
    if (value.isEmpty) return 'Password is required';
    if (value.length < 8) return 'Password must be at least 8 characters';
    if (!RegExp(r'[A-Z]').hasMatch(value)) return 'Include an uppercase letter';
    if (!RegExp(r'[a-z]').hasMatch(value)) return 'Include a lowercase letter';
    if (!RegExp(r'[0-9]').hasMatch(value)) return 'Include a number';
    if (!RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(value)) {
      return 'Include a special character';
    }
    return null;
  }

  String? _validateConfirmPassword(String password, String confirm) {
    if (confirm.isEmpty) return 'Please confirm your password';
    if (password != confirm) return 'Passwords do not match';
    return null;
  }

  String _mapGender(String gender) {
    switch (gender.toLowerCase()) {
      case 'male':
        return 'MALE';
      case 'female':
        return 'FEMALE';
      default:
        return 'OTHER';
    }
  }
}
