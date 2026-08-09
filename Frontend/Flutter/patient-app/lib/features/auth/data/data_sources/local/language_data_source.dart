// lib/features/auth/data/datasources/language_local_datasource.dart
import 'package:shared_preferences/shared_preferences.dart';

class LanguageLocalDataSource {
  final SharedPreferences sharedPreferences;

  LanguageLocalDataSource({required this.sharedPreferences});

  static const String _languageKey = 'selected_language';

  Future<void> saveLanguage(String language) async {
    await sharedPreferences.setString(_languageKey, language);
  }

  Future<String> getLanguage() async {
    return sharedPreferences.getString(_languageKey) ?? 'English';
  }
}