import 'package:shared_preferences/shared_preferences.dart';

// lib/features/auth/data/data_sources/local/auth_local_data_source.dart

class AuthLocalDataSource {
  Future<void> setOnboardingCompleted() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_completed', true);
  }

  Future<bool> isOnboardingCompleted() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('onboarding_completed') ?? false;
  }
  
  // Your existing methods...
}