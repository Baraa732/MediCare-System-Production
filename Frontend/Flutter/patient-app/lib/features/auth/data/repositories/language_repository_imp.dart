// lib/features/auth/data/repositories/language_repository_impl.dart
import 'package:cms/features/auth/data/data_sources/local/language_data_source.dart';
import 'package:cms/features/auth/domain/repositories/language_repository.dart';

class LanguageRepositoryImpl implements LanguageRepository {
  final LanguageLocalDataSource localDataSource;

  LanguageRepositoryImpl({required this.localDataSource});

  @override
  Future<void> saveLanguage(String language) async {
    await localDataSource.saveLanguage(language);
  }

  @override
  Future<String> getLanguage() async {
    return await localDataSource.getLanguage();
  }
} 