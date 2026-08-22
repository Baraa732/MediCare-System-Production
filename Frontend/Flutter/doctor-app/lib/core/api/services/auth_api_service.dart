import 'dart:io';

import 'package:cms_doctor_app/core/api/api_client.dart';
import 'package:cms_doctor_app/core/storage/session_storage.dart';
import 'package:cms_doctor_app/core/utils/phone_utils.dart';
import 'package:dio/dio.dart';

class LoginResult {
  final AuthSession? session;
  final bool requiresMfa;
  final String? mfaToken;
  final bool requiresPasswordChange;
  final String? errorCode;

  const LoginResult({
    this.session,
    this.requiresMfa = false,
    this.mfaToken,
    this.requiresPasswordChange = false,
    this.errorCode,
  });
}

class MfaVerifyResult {
  final AuthSession? session;
  final bool requiresPasswordChange;
  final String? activationToken;

  const MfaVerifyResult({
    this.session,
    this.requiresPasswordChange = false,
    this.activationToken,
  });
}

class AuthApiService {
  AuthApiService(this._client, this._session);

  final ApiClient _client;
  final SessionStorage _session;

  Future<LoginResult> login({
    required String phoneNumber,
    required String password,
  }) async {
    final response = await _client.post(
      '/auth/login',
      data: {
        'phoneNumber': formatPhoneForApi(phoneNumber),
        'password': password,
      },
      options: Options(extra: {'skipAuth': true}),
    );
    final data = response.data as Map<String, dynamic>;
    if (data['requiresMfa'] == true) {
      return LoginResult(
        requiresMfa: true,
        mfaToken: data['mfaToken'] as String?,
        requiresPasswordChange: data['requiresPasswordChange'] == true,
      );
    }
    final session = AuthSession.fromJson(data);
    if (session.role != 'DOCTOR') {
      await _session.clearSession();
      return const LoginResult(errorCode: 'NOT_DOCTOR');
    }
    if (session.clinicId == null || session.clinicId!.isEmpty) {
      return const LoginResult(errorCode: 'NO_CLINIC');
    }
    await _session.saveSession(session);
    await refreshProfileNames();
    return LoginResult(session: session);
  }

  Future<MfaVerifyResult> verifyMfa({
    required String mfaToken,
    required String otp,
  }) async {
    final response = await _client.post(
      '/auth/verify-mfa',
      data: {'mfaToken': mfaToken, 'otp': otp},
      options: Options(extra: {'skipAuth': true}),
    );
    final data = response.data as Map<String, dynamic>;

    if (data['requiresPasswordChange'] == true) {
      final activationToken = data['activationToken']?.toString() ?? '';
      if (activationToken.isEmpty) {
        throw Exception('Activation token missing. Please sign in again.');
      }
      return MfaVerifyResult(
        requiresPasswordChange: true,
        activationToken: activationToken,
      );
    }

    final session = AuthSession.fromJson(data);
    if (session.role != 'DOCTOR') {
      throw Exception('This app is for doctors only');
    }
    if (session.clinicId == null || session.clinicId!.isEmpty) {
      throw Exception('No clinic access');
    }
    await _session.saveSession(session);
    await refreshProfileNames();
    return MfaVerifyResult(session: session);
  }

  Future<AuthSession> completeStaffActivation({
    required String activationToken,
    required String newPassword,
  }) async {
    final response = await _client.post(
      '/auth/staff/complete-activation',
      data: {
        'activationToken': activationToken,
        'newPassword': newPassword,
      },
      options: Options(extra: {'skipAuth': true}),
    );
    final session = AuthSession.fromJson(response.data as Map<String, dynamic>);
    if (session.role != 'DOCTOR') {
      throw Exception('This app is for doctors only');
    }
    if (session.clinicId == null || session.clinicId!.isEmpty) {
      throw Exception('No clinic access');
    }
    await _session.saveSession(session);
    await refreshProfileNames();
    return session;
  }

  /// Loads the signed-in doctor's real name from `/users/:id`.
  Future<Map<String, dynamic>?> fetchOwnProfile() async {
    final userId = _session.userId;
    if (userId == null || userId.isEmpty) return null;
    final response = await _client.get('/users/$userId');
    final data = response.data;
    if (data is! Map) return null;
    final map = Map<String, dynamic>.from(data);
    if (map['user'] is Map) {
      return Map<String, dynamic>.from(map['user'] as Map);
    }
    return map;
  }

  Future<void> refreshProfileNames() async {
    try {
      final map = await fetchOwnProfile();
      if (map == null) return;
      final first = map['firstName']?.toString();
      final last = map['lastName']?.toString();
      await _session.updateNames(firstName: first, lastName: last);
    } catch (_) {
      // Keep whatever name we already have from auth/session.
    }
  }

  Future<Map<String, dynamic>> updateOwnProfile({
    String? firstName,
    String? lastName,
    String? email,
    String? specialization,
  }) async {
    final userId = _session.userId;
    if (userId == null) throw Exception('Not signed in');
    final response = await _client.put(
      '/users/$userId',
      data: {
        if (firstName != null) 'firstName': firstName,
        if (lastName != null) 'lastName': lastName,
        if (email != null) 'email': email,
        if (specialization != null) 'specialization': specialization,
      },
    );
    final data = response.data;
    final map = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    await _session.updateNames(
      firstName: map['firstName']?.toString() ?? firstName,
      lastName: map['lastName']?.toString() ?? lastName,
    );
    return map;
  }

  Future<Map<String, dynamic>> uploadOwnAvatar(File file) async {
    final userId = _session.userId;
    if (userId == null) throw Exception('Not signed in');
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        file.path,
        filename: file.path.split(RegExp(r'[\\/]')).last,
      ),
    });
    final response = await _client.dio.post(
      '/users/$userId/avatar',
      data: form,
      options: Options(contentType: 'multipart/form-data'),
    );
    final data = response.data;
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return {};
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final userId = _session.userId;
    if (userId == null) throw Exception('Not signed in');
    await _client.post(
      '/users/$userId/change-password',
      data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      },
    );
  }

  Future<void> forgotPasswordSendOtp(String phoneNumber) async {
    await _client.post(
      '/auth/forgot-password/send-otp',
      data: {'phoneNumber': formatPhoneForApi(phoneNumber)},
      options: Options(extra: {'skipAuth': true}),
    );
  }

  Future<String> forgotPasswordVerifyOtp({
    required String phoneNumber,
    required String otp,
  }) async {
    final response = await _client.post(
      '/auth/forgot-password/verify-otp',
      data: {
        'phoneNumber': formatPhoneForApi(phoneNumber),
        'otp': otp,
      },
      options: Options(extra: {'skipAuth': true}),
    );
    final data = response.data as Map<String, dynamic>;
    return data['resetToken']?.toString() ?? data['token']?.toString() ?? '';
  }

  Future<void> resetPassword({
    required String resetToken,
    required String newPassword,
  }) async {
    await _client.post(
      '/auth/reset-password',
      data: {
        'resetToken': resetToken,
        'newPassword': newPassword,
        'password': newPassword,
      },
      options: Options(extra: {'skipAuth': true}),
    );
  }

  Future<void> logout() async {
    try {
      await _client.post('/auth/logout');
    } catch (_) {}
    await _session.clearSession();
  }
}
