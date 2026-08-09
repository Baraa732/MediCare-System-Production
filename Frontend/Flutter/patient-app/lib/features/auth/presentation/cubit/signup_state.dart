import 'dart:io';

enum SignupStep { personal, contact, security }

class SignupState {
  static const _unset = Object();

  final SignupStep currentStep;
  final String firstName;
  final String lastName;
  final String gender;
  final DateTime? dateOfBirth;
  final String phoneNumber;
  final String email;
  final String governorate;
  final String password;
  final String confirmPassword;
  final bool acceptedTerms;
  final String? firstNameError;
  final String? lastNameError;
  final String? genderError;
  final String? dobError;
  final String? phoneError;
  final String? emailError;
  final String? passwordError;
  final String? confirmPasswordError;
  final String? termsError;
  final String? errorMessage;
  final bool isLoading;
  final bool shouldNavigateToOtp;
  final bool isPasswordVisible;
  final bool isConfirmPasswordVisible;
  final File? profileImage;

  const SignupState({
    this.currentStep = SignupStep.personal,
    this.firstName = '',
    this.lastName = '',
    this.gender = '',
    this.dateOfBirth,
    this.phoneNumber = '',
    this.email = '',
    this.governorate = '',
    this.password = '',
    this.confirmPassword = '',
    this.acceptedTerms = false,
    this.firstNameError,
    this.lastNameError,
    this.genderError,
    this.dobError,
    this.phoneError,
    this.emailError,
    this.passwordError,
    this.confirmPasswordError,
    this.termsError,
    this.errorMessage,
    this.isLoading = false,
    this.shouldNavigateToOtp = false,
    this.isPasswordVisible = false,
    this.isConfirmPasswordVisible = false,
    this.profileImage,
  });

  int get stepIndex => currentStep.index;
  int get totalSteps => SignupStep.values.length;

  bool get isPersonalStepValid =>
      firstNameError == null &&
      lastNameError == null &&
      genderError == null &&
      dobError == null &&
      firstName.trim().length >= 2 &&
      lastName.trim().length >= 2 &&
      gender.isNotEmpty &&
      dateOfBirth != null;

  bool get isContactStepValid =>
      phoneError == null &&
      emailError == null &&
      phoneNumber.replaceAll(RegExp(r'[^0-9]'), '').length == 10;

  bool get isSecurityStepValid =>
      passwordError == null &&
      confirmPasswordError == null &&
      termsError == null &&
      password.isNotEmpty &&
      confirmPassword.isNotEmpty &&
      acceptedTerms;

  bool get isCurrentStepValid {
    switch (currentStep) {
      case SignupStep.personal:
        return isPersonalStepValid;
      case SignupStep.contact:
        return isContactStepValid;
      case SignupStep.security:
        return isSecurityStepValid;
    }
  }

  SignupState copyWith({
    SignupStep? currentStep,
    String? firstName,
    String? lastName,
    String? gender,
    Object? dateOfBirth = _unset,
    bool clearDateOfBirth = false,
    String? phoneNumber,
    String? email,
    String? governorate,
    String? password,
    String? confirmPassword,
    bool? acceptedTerms,
    Object? firstNameError = _unset,
    Object? lastNameError = _unset,
    Object? genderError = _unset,
    Object? dobError = _unset,
    Object? phoneError = _unset,
    Object? emailError = _unset,
    Object? passwordError = _unset,
    Object? confirmPasswordError = _unset,
    Object? termsError = _unset,
    Object? errorMessage = _unset,
    bool? isLoading,
    bool? shouldNavigateToOtp,
    bool? isPasswordVisible,
    bool? isConfirmPasswordVisible,
    Object? profileImage = _unset,
    bool clearProfileImage = false,
  }) {
    return SignupState(
      currentStep: currentStep ?? this.currentStep,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      gender: gender ?? this.gender,
      dateOfBirth: clearDateOfBirth
          ? null
          : (identical(dateOfBirth, _unset)
              ? this.dateOfBirth
              : dateOfBirth as DateTime?),
      phoneNumber: phoneNumber ?? this.phoneNumber,
      email: email ?? this.email,
      governorate: governorate ?? this.governorate,
      password: password ?? this.password,
      confirmPassword: confirmPassword ?? this.confirmPassword,
      acceptedTerms: acceptedTerms ?? this.acceptedTerms,
      firstNameError: identical(firstNameError, _unset)
          ? this.firstNameError
          : firstNameError as String?,
      lastNameError: identical(lastNameError, _unset)
          ? this.lastNameError
          : lastNameError as String?,
      genderError: identical(genderError, _unset)
          ? this.genderError
          : genderError as String?,
      dobError:
          identical(dobError, _unset) ? this.dobError : dobError as String?,
      phoneError: identical(phoneError, _unset)
          ? this.phoneError
          : phoneError as String?,
      emailError: identical(emailError, _unset)
          ? this.emailError
          : emailError as String?,
      passwordError: identical(passwordError, _unset)
          ? this.passwordError
          : passwordError as String?,
      confirmPasswordError: identical(confirmPasswordError, _unset)
          ? this.confirmPasswordError
          : confirmPasswordError as String?,
      termsError:
          identical(termsError, _unset) ? this.termsError : termsError as String?,
      errorMessage: identical(errorMessage, _unset)
          ? this.errorMessage
          : errorMessage as String?,
      isLoading: isLoading ?? this.isLoading,
      shouldNavigateToOtp: shouldNavigateToOtp ?? this.shouldNavigateToOtp,
      isPasswordVisible: isPasswordVisible ?? this.isPasswordVisible,
      isConfirmPasswordVisible:
          isConfirmPasswordVisible ?? this.isConfirmPasswordVisible,
      profileImage: clearProfileImage
          ? null
          : (identical(profileImage, _unset)
              ? this.profileImage
              : profileImage as File?),
    );
  }
}
