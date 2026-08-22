import 'dart:io';

class EditProfileState {
  final String fullName;
  final String phoneNumber;
  final String email;
  final File? profileImage;
  final String? existingAvatarUrl;
  final bool isLoading;
  final bool isValid;
  final bool saved;
  final String? errorMessage;

  const EditProfileState({
    this.fullName = '',
    this.phoneNumber = '',
    this.email = '',
    this.profileImage,
    this.existingAvatarUrl,
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
    String? existingAvatarUrl,
    bool? isLoading,
    bool? isValid,
    bool? saved,
    String? errorMessage,
    bool clearProfileImage = false,
  }) {
    return EditProfileState(
      fullName: fullName ?? this.fullName,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      email: email ?? this.email,
      profileImage:
          clearProfileImage ? null : (profileImage ?? this.profileImage),
      existingAvatarUrl: existingAvatarUrl ?? this.existingAvatarUrl,
      isLoading: isLoading ?? this.isLoading,
      isValid: isValid ?? this.isValid,
      saved: saved ?? this.saved,
      errorMessage: errorMessage,
    );
  }
}
