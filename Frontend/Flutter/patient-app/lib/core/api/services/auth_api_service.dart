import 'package:cms/core/api/api_client.dart';
import 'package:cms/core/storage/session_storage.dart';
import 'package:cms/core/utils/phone_utils.dart';
import 'package:dio/dio.dart';

class LoginResult {
  final AuthSession? session;
  final bool requiresMfa;
  final String? mfaToken;
  final String? errorCode;

  const LoginResult({
    this.session,
    this.requiresMfa = false,
    this.mfaToken,
    this.errorCode,
  });
}

class AuthApiService {
  AuthApiService(this._client, this._sessionStorage);

  static const _clientApp = 'patient-mobile';

  final ApiClient _client;
  final SessionStorage _sessionStorage;

  bool _isPatientRole(String? role) => role == 'PATIENT';

  Future<LoginResult> login({
    required String phoneNumber,
    required String password,
  }) async {
    final response = await _client.post(
      '/auth/login',
      data: {
        'phoneNumber': formatPhoneForApi(phoneNumber),
        'password': password,
        'clientApp': _clientApp,
      },
      options: Options(extra: {'skipAuth': true}),
    );

    final data = response.data as Map<String, dynamic>;
    if (data['requiresMfa'] == true) {
      final role = data['role']?.toString();
      if (!_isPatientRole(role)) {
        return const LoginResult(errorCode: 'NOT_PATIENT');
      }
      return LoginResult(
        requiresMfa: true,
        mfaToken: data['mfaToken'] as String?,
      );
    }

    final session = AuthSession.fromJson(data);
    if (!_isPatientRole(session.role)) {
      await _sessionStorage.clearSession();
      return const LoginResult(errorCode: 'NOT_PATIENT');
    }
    await _sessionStorage.saveSession(session);
    return LoginResult(session: session);
  }

  Future<AuthSession> verifyMfa({
    required String mfaToken,
    required String otp,
  }) async {
    final response = await _client.post(
      '/auth/verify-mfa',
      data: {
        'mfaToken': mfaToken,
        'otp': otp,
        'clientApp': _clientApp,
      },
      options: Options(extra: {'skipAuth': true}),
    );
    final session = AuthSession.fromJson(response.data as Map<String, dynamic>);
    if (!_isPatientRole(session.role)) {
      await _sessionStorage.clearSession();
      throw Exception('This app is for patients only');
    }
    await _sessionStorage.saveSession(session);
    return session;
  }

  Future<void> registerPatient({
    required String phoneNumber,
    required String firstName,
    required String lastName,
    required String password,
    String? email,
    String? gender,
    String? birthDate,
    String? governorate,
  }) async {
    await _client.post(
      '/auth/register',
      data: {
        'phoneNumber': formatPhoneForApi(phoneNumber),
        'firstName': firstName,
        'lastName': lastName,
        'password': password,
        'role': 'PATIENT',
        if (email != null && email.isNotEmpty) 'email': email,
        if (gender != null && gender.isNotEmpty) 'gender': gender.toUpperCase(),
        if (birthDate != null && birthDate.isNotEmpty) 'birthDate': birthDate,
        if (governorate != null && governorate.isNotEmpty) 'governorate': governorate,
      },
      options: Options(
        extra: {'skipAuth': true},
        headers: {'Idempotency-Key': newIdempotencyKey()},
      ),
    );
  }

  Future<void> sendOtp(String phoneNumber) async {
    await _client.post(
      '/auth/send-otp',
      data: {'phoneNumber': formatPhoneForApi(phoneNumber)},
      options: Options(extra: {'skipAuth': true}),
    );
  }

  Future<AuthSession> verifyOtp({
    required String phoneNumber,
    required String otp,
  }) async {
    final response = await _client.post(
      '/auth/verify-otp',
      data: {
        'phoneNumber': formatPhoneForApi(phoneNumber),
        'otp': otp,
        'autoLogin': 'true',
      },
      options: Options(extra: {'skipAuth': true}),
    );
    final session = AuthSession.fromJson(response.data as Map<String, dynamic>);
    if (!_isPatientRole(session.role)) {
      await _sessionStorage.clearSession();
      throw Exception('This app is for patients only');
    }
    await _sessionStorage.saveSession(session);
    return session;
  }

  Future<void> resendOtp(String phoneNumber) async {
    await _client.post(
      '/auth/resend-otp',
      data: {'phoneNumber': formatPhoneForApi(phoneNumber)},
      options: Options(extra: {'skipAuth': true}),
    );
  }

  Future<void> resendMfaOtp(String mfaToken) async {
    await _client.post(
      '/auth/resend-mfa-otp',
      data: {'mfaToken': mfaToken},
      options: Options(extra: {'skipAuth': true}),
    );
  }

  Future<void> forgotPasswordSendOtp(String phoneNumber) async {
    await _client.post(
      '/auth/forgot-password/send-otp',
      data: {'phoneNumber': formatPhoneForApi(phoneNumber)},
      options: Options(extra: {'skipAuth': true}),
    );
  }

  Future<void> forgotPasswordVerifyOtp({
    required String phoneNumber,
    required String otp,
  }) async {
    await _client.post(
      '/auth/forgot-password/verify-otp',
      data: {
        'phoneNumber': formatPhoneForApi(phoneNumber),
        'otp': otp,
      },
      options: Options(extra: {'skipAuth': true}),
    );
  }

  Future<AuthSession> resetPassword({
    required String phoneNumber,
    required String otp,
    required String newPassword,
  }) async {
    final response = await _client.post(
      '/auth/reset-password',
      data: {
        'phoneNumber': formatPhoneForApi(phoneNumber),
        'otp': otp,
        'newPassword': newPassword,
        'clientApp': _clientApp,
      },
      options: Options(extra: {'skipAuth': true}),
    );
    final session = AuthSession.fromJson(response.data as Map<String, dynamic>);
    if (!_isPatientRole(session.role)) {
      await _sessionStorage.clearSession();
      throw Exception('This app is for patients only');
    }
    await _sessionStorage.saveSession(session);
    return session;
  }

  Future<void> logout() async {
    final refresh = _sessionStorage.refreshToken;
    try {
      if (refresh != null) {
        await _client.post('/auth/logout', data: {'refreshToken': refresh});
      }
    } finally {
      await _sessionStorage.clearSession();
    }
  }
}
