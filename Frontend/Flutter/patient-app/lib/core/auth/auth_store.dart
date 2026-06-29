/// Tenant-aware auth session storage for patient-app.
library;

import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class AuthSession {
  AuthSession({
    required this.userId,
    required this.role,
    required this.accessToken,
    required this.refreshToken,
    this.tenantId,
    this.clinicId,
  });

  final String userId;
  final String role;
  final String accessToken;
  final String refreshToken;
  final String? tenantId;
  final String? clinicId;

  String? get effectiveTenantId => tenantId ?? clinicId;

  Map<String, dynamic> toJson() => {
        'userId': userId,
        'role': role,
        'accessToken': accessToken,
        'refreshToken': refreshToken,
        'tenantId': tenantId ?? clinicId,
        'clinicId': clinicId ?? tenantId,
      };

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    final tenant = json['tenantId'] as String? ?? json['clinicId'] as String?;
    return AuthSession(
      userId: json['userId'] as String? ?? '',
      role: json['role'] as String? ?? '',
      accessToken: json['accessToken'] as String? ?? '',
      refreshToken: json['refreshToken'] as String? ?? '',
      tenantId: tenant,
      clinicId: tenant,
    );
  }
}

class AuthStore {
  AuthStore(this._prefs);

  static const _key = 'patient-app-auth';
  final SharedPreferences _prefs;

  static Future<AuthStore> create() async {
    return AuthStore(await SharedPreferences.getInstance());
  }

  AuthSession? get session {
    final raw = _prefs.getString(_key);
    if (raw == null) return null;
    return AuthSession.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  Future<void> setSession(AuthSession value) async {
    await _prefs.setString(_key, jsonEncode(value.toJson()));
  }

  Future<void> clear() async {
    await _prefs.remove(_key);
  }
}
