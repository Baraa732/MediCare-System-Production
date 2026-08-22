import 'dart:io';
import 'package:cms/core/api/api_exception.dart';
import 'package:cms/core/api/services/user_api_service.dart';
import 'package:cms/core/storage/session_storage.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'edit_profile_state.dart';

class EditProfileCubit extends Cubit<EditProfileState> {
  EditProfileCubit(this._userApi, this._sessionStorage)
      : super(const EditProfileState()) {
    loadProfile();
  }

  final UserApiService _userApi;
  final SessionStorage _sessionStorage;

  Future<void> loadProfile() async {
    final userId = _sessionStorage.userId;
    if (userId == null || userId.isEmpty) return;

    emit(state.copyWith(isLoading: true, errorMessage: null));
    try {
      final profile = await _userApi.getProfile(userId);
      emit(state.copyWith(
        isLoading: false,
        fullName: profile.fullName,
        phoneNumber: profile.phoneNumber,
        email: profile.email ?? '',
        existingAvatarUrl: profile.avatarUrl,
        isValid: profile.fullName.trim().isNotEmpty,
      ));
    } on ApiException catch (e) {
      emit(state.copyWith(isLoading: false, errorMessage: e.message));
    }
  }

  void onNameChanged(String value) {
    emit(state.copyWith(
      fullName: value,
      isValid: value.trim().isNotEmpty && state.phoneNumber.trim().isNotEmpty,
    ));
  }

  void onPhoneChanged(String value) {
    emit(state.copyWith(
      phoneNumber: value,
      isValid: state.fullName.trim().isNotEmpty && value.trim().isNotEmpty,
    ));
  }

  Future<void> pickProfileImage() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 800,
      maxHeight: 800,
      imageQuality: 85,
    );
    if (pickedFile != null) {
      emit(state.copyWith(profileImage: File(pickedFile.path)));
    }
  }

  Future<void> saveProfile() async {
    if (!state.isValid) return;
    final userId = _sessionStorage.userId;
    if (userId == null) return;

    emit(state.copyWith(isLoading: true, errorMessage: null));
    try {
      final parts = state.fullName.trim().split(RegExp(r'\s+'));
      final firstName = parts.isNotEmpty ? parts.first : state.fullName;
      final lastName =
          parts.length > 1 ? parts.sublist(1).join(' ') : parts.first;

      await _userApi.updateProfile(
        userId,
        firstName: firstName,
        lastName: lastName,
        email: state.email.isNotEmpty ? state.email : null,
      );

      String? avatarUrl = state.existingAvatarUrl;
      if (state.profileImage != null) {
        final uploaded = await _userApi.uploadAvatar(userId, state.profileImage!);
        avatarUrl = uploaded.avatarUrl ?? avatarUrl;
      }

      emit(state.copyWith(
        isLoading: false,
        saved: true,
        existingAvatarUrl: avatarUrl,
        clearProfileImage: true,
      ));
    } on ApiException catch (e) {
      emit(state.copyWith(isLoading: false, errorMessage: e.message));
    }
  }
}
