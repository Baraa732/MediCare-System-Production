// lib/features/auth/domain/use_cases/get_saved_language_use_case.dart
import 'package:cms/features/auth/domain/repositories/language_repository.dart';

class GetSavedLanguageUseCase {
  final LanguageRepository repository;

  GetSavedLanguageUseCase({required this.repository});

  Future<String> call() async {
    return await repository.getLanguage();
  }
}