import 'package:shared_preferences/shared_preferences.dart';

class AuthSession {
  final String accessToken;
  final String refreshToken;
  final String userId;
  final String role;

  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.userId,
    required this.role,
  });

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    return AuthSession(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      userId: json['userId'] as String? ?? '',
      role: json['role'] as String? ?? '',
    );
  }
}

class SessionStorage {
  static const _accessTokenKey = 'medicare_access_token';
  static const _refreshTokenKey = 'medicare_refresh_token';
  static const _userIdKey = 'medicare_user_id';
  static const _roleKey = 'medicare_user_role';

  final SharedPreferences _prefs;

  SessionStorage(this._prefs);

  String? get accessToken => _prefs.getString(_accessTokenKey);
  String? get refreshToken => _prefs.getString(_refreshTokenKey);
  String? get userId => _prefs.getString(_userIdKey);
  String? get role => _prefs.getString(_roleKey);

  bool get isLoggedIn =>
      accessToken != null &&
      accessToken!.isNotEmpty &&
      userId != null &&
      userId!.isNotEmpty &&
      role == 'PATIENT';

  Future<void> saveSession(AuthSession session) async {
    await _prefs.setString(_accessTokenKey, session.accessToken);
    await _prefs.setString(_refreshTokenKey, session.refreshToken);
    await _prefs.setString(_userIdKey, session.userId);
    await _prefs.setString(_roleKey, session.role);
  }

  Future<void> updateTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _prefs.setString(_accessTokenKey, accessToken);
    await _prefs.setString(_refreshTokenKey, refreshToken);
  }

  Future<void> clearSession() async {
    await _prefs.remove(_accessTokenKey);
    await _prefs.remove(_refreshTokenKey);
    await _prefs.remove(_userIdKey);
    await _prefs.remove(_roleKey);
  }
}
