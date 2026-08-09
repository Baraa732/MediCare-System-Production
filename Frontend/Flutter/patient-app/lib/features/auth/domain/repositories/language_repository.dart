// lib/features/auth/domain/repositories/language_repository.dart
abstract class LanguageRepository {
  Future<void> saveLanguage(String language);
  Future<String> getLanguage();
}