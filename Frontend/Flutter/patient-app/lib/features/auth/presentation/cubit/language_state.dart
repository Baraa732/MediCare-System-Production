class LanguageState {
  final String selectedLanguage;
  final List<String> languages;

  const LanguageState({
    required this.selectedLanguage,
    this.languages = const ['English', 'العربية'],
  });

  LanguageState copyWith({String? selectedLanguage, List<String>? languages}) {
    return LanguageState(
      selectedLanguage: selectedLanguage ?? this.selectedLanguage,
      languages: languages ?? this.languages,
    );
  }
}
