// lib/features/auth/domain/use_cases/save_language_use_case.dart
import 'package:cms/features/auth/domain/repositories/language_repository.dart';

class SaveLanguageUseCase {
  final LanguageRepository repository;

  SaveLanguageUseCase({required this.repository});

  Future<void> call(String language) async {
    await repository.saveLanguage(language);
  }
}