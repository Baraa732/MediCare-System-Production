import 'dart:io';

class EditProfileState {
  final String fullName;
  final String phoneNumber;
  final String email;
  final File? profileImage;
  final bool isLoading;
  final bool isValid;
  final bool saved;
  final String? errorMessage;

  const EditProfileState({
    this.fullName = '',
    this.phoneNumber = '',
    this.email = '',
    this.profileImage,
    this.isLoading = false,
    this.isValid = false,
    this.saved = false,
    this.errorMessage,
  });

  EditProfileState copyWith({
    String? fullName,
    String? phoneNumber,
    String? email,
    File? profileImage,
    bool? isLoading,
    bool? isValid,
    bool? saved,
    String? errorMessage,
  }) {
    return EditProfileState(
      fullName: fullName ?? this.fullName,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      email: email ?? this.email,
      profileImage: profileImage ?? this.profileImage,
      isLoading: isLoading ?? this.isLoading,
      isValid: isValid ?? this.isValid,
      saved: saved ?? this.saved,
      errorMessage: errorMessage,
    );
  }
}
