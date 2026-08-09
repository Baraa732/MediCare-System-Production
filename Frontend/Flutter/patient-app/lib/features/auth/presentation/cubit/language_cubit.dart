// lib/features/auth/presentation/cubit/language_cubit.dart
import 'package:bloc/bloc.dart';
import 'package:cms/features/auth/domain/use_cases/change_language_use_case.dart';
import 'package:cms/features/auth/domain/use_cases/get_saved_language_use_case.dart';
import 'package:cms/features/auth/presentation/cubit/language_state.dart';

class LanguageCubit extends Cubit<LanguageState> {
  final GetSavedLanguageUseCase getSavedLanguageUseCase;
  final SaveLanguageUseCase saveLanguageUseCase;

  LanguageCubit({
    required this.getSavedLanguageUseCase,
    required this.saveLanguageUseCase,
  }) : super(const LanguageState(selectedLanguage: 'English')) {
    _loadSavedLanguage();
  }

  Future<void> _loadSavedLanguage() async {
    final savedLanguage = await getSavedLanguageUseCase();
    emit(state.copyWith(selectedLanguage: savedLanguage));
  }

  Future<void> changeLanguage(String language) async {
    await saveLanguageUseCase(language);
    emit(state.copyWith(selectedLanguage: language));
  }
}