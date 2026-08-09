import 'package:cms/core/api/api_exception.dart';
import 'package:cms/core/api/services/auth_api_service.dart';
import 'package:cms/core/api/services/user_api_service.dart';
import 'package:cms/core/storage/session_storage.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'profile_state.dart';

class ProfileCubit extends Cubit<ProfileState> {
  ProfileCubit(this._userApi, this._sessionStorage, this._authApi)
      : super(const ProfileState());

  final UserApiService _userApi;
  final SessionStorage _sessionStorage;
  final AuthApiService _authApi;

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
        email: profile.email,
        avatarUrl: profile.avatarUrl,
      ));
    } on ApiException catch (e) {
      emit(state.copyWith(isLoading: false, errorMessage: e.message));
    } catch (_) {
      emit(state.copyWith(
        isLoading: false,
        errorMessage: 'Could not load profile.',
      ));
    }
  }

  Future<bool> signOut() async {
    emit(state.copyWith(isSigningOut: true));
    try {
      await _authApi.logout();
      emit(const ProfileState());
      return true;
    } catch (_) {
      emit(state.copyWith(isSigningOut: false));
      return false;
    }
  }
}
