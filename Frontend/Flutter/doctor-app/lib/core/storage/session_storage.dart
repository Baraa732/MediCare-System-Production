import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class AuthSession {
  final String accessToken;
  final String refreshToken;
  final String userId;
  final String role;
  final String? clinicId;
  final String? firstName;
  final String? lastName;

  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.userId,
    required this.role,
    this.clinicId,
    this.firstName,
    this.lastName,
  });

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    final token = json['accessToken'] as String? ?? '';
    final claims = _decodeJwt(token);
    final user = json['user'] is Map
        ? Map<String, dynamic>.from(json['user'] as Map)
        : const <String, dynamic>{};
    return AuthSession(
      accessToken: token,
      refreshToken: json['refreshToken'] as String? ?? '',
      userId: json['userId']?.toString() ??
          user['id']?.toString() ??
          claims['sub']?.toString() ??
          '',
      role: json['role']?.toString() ??
          user['role']?.toString() ??
          claims['role']?.toString() ??
          'DOCTOR',
      clinicId: json['clinicId']?.toString() ??
          json['tenantId']?.toString() ??
          user['clinicId']?.toString() ??
          user['tenantId']?.toString() ??
          claims['tenantId']?.toString() ??
          claims['clinicId']?.toString(),
      firstName: json['firstName']?.toString() ??
          user['firstName']?.toString() ??
          claims['firstName']?.toString(),
      lastName: json['lastName']?.toString() ??
          user['lastName']?.toString() ??
          claims['lastName']?.toString(),
    );
  }

  static Map<String, dynamic> _decodeJwt(String token) {
    try {
      final parts = token.split('.');
      if (parts.length < 2) return {};
      var payload = parts[1].replaceAll('-', '+').replaceAll('_', '/');
      while (payload.length % 4 != 0) {
        payload += '=';
      }
      final decoded = utf8.decode(base64Decode(payload));
      final map = jsonDecode(decoded);
      return map is Map<String, dynamic> ? map : {};
    } catch (_) {
      return {};
    }
  }
}

class SessionStorage {
  static const _accessTokenKey = 'doctor_access_token';
  static const _refreshTokenKey = 'doctor_refresh_token';
  static const _userIdKey = 'doctor_user_id';
  static const _roleKey = 'doctor_user_role';
  static const _clinicIdKey = 'doctor_clinic_id';
  static const _firstNameKey = 'doctor_first_name';
  static const _lastNameKey = 'doctor_last_name';
  static const _avatarUrlKey = 'doctor_avatar_url';

  final SharedPreferences _prefs;

  SessionStorage(this._prefs);

  String? get accessToken => _prefs.getString(_accessTokenKey);
  String? get refreshToken => _prefs.getString(_refreshTokenKey);
  String? get userId => _prefs.getString(_userIdKey);
  String? get role => _prefs.getString(_roleKey);
  String? get clinicId => _prefs.getString(_clinicIdKey);
  String? get firstName => _prefs.getString(_firstNameKey);
  String? get lastName => _prefs.getString(_lastNameKey);
  String? get avatarUrl => _prefs.getString(_avatarUrlKey);

  String get displayName {
    var name = '${firstName ?? ''} ${lastName ?? ''}'.trim();
    if (name.toLowerCase().startsWith('dr.')) {
      name = name.substring(3).trim();
    } else if (name.toLowerCase().startsWith('dr ')) {
      name = name.substring(3).trim();
    }
    return name.isEmpty ? 'Doctor' : name;
  }

  bool get isLoggedIn =>
      accessToken != null &&
      accessToken!.isNotEmpty &&
      userId != null &&
      userId!.isNotEmpty &&
      role == 'DOCTOR';

  Future<void> saveSession(AuthSession session) async {
    await _prefs.setString(_accessTokenKey, session.accessToken);
    await _prefs.setString(_refreshTokenKey, session.refreshToken);
    await _prefs.setString(_userIdKey, session.userId);
    await _prefs.setString(_roleKey, session.role);
    if (session.clinicId != null) {
      await _prefs.setString(_clinicIdKey, session.clinicId!);
    }
    if (session.firstName != null && session.firstName!.trim().isNotEmpty) {
      await _prefs.setString(_firstNameKey, session.firstName!.trim());
    }
    if (session.lastName != null && session.lastName!.trim().isNotEmpty) {
      await _prefs.setString(_lastNameKey, session.lastName!.trim());
    }
  }

  Future<void> updateNames({String? firstName, String? lastName}) async {
    if (firstName != null && firstName.trim().isNotEmpty) {
      await _prefs.setString(_firstNameKey, firstName.trim());
    }
    if (lastName != null && lastName.trim().isNotEmpty) {
      await _prefs.setString(_lastNameKey, lastName.trim());
    }
  }

  Future<void> updateAvatarUrl(String? avatarUrl) async {
    final trimmed = avatarUrl?.trim();
    if (trimmed == null || trimmed.isEmpty) {
      await _prefs.remove(_avatarUrlKey);
      return;
    }
    await _prefs.setString(_avatarUrlKey, trimmed);
  }

  Future<void> updateTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _prefs.setString(_accessTokenKey, accessToken);
    await _prefs.setString(_refreshTokenKey, refreshToken);
    final claims = AuthSession._decodeJwt(accessToken);
    final clinic = claims['tenantId']?.toString() ?? claims['clinicId']?.toString();
    if (clinic != null && clinic.isNotEmpty) {
      await _prefs.setString(_clinicIdKey, clinic);
    }
  }

  Future<void> clearSession() async {
    await _prefs.remove(_accessTokenKey);
    await _prefs.remove(_refreshTokenKey);
    await _prefs.remove(_userIdKey);
    await _prefs.remove(_roleKey);
    await _prefs.remove(_clinicIdKey);
    await _prefs.remove(_firstNameKey);
    await _prefs.remove(_lastNameKey);
    await _prefs.remove(_avatarUrlKey);
  }
}
