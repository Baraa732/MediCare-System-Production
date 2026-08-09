import 'package:flutter/material.dart';

import '../navigation/app_navigation.dart';

final ValueNotifier<String> selectedLanguage = ValueNotifier('English');

const _languages = ['English', 'Arabic'];

Future<void> showLanguagePicker(BuildContext context) async {
  final choice = await showModalBottomSheet<String>(
    context: context,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (context) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'App Language',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
          ),
          ..._languages.map(
            (lang) => ListTile(
              title: Text(lang),
              trailing: selectedLanguage.value == lang
                  ? const Icon(Icons.check, color: Color(0xFF0B74FA))
                  : null,
              onTap: () => Navigator.pop(context, lang),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    ),
  );

  if (choice != null && choice != selectedLanguage.value) {
    selectedLanguage.value = choice;
    if (context.mounted) {
      showSnack(context, 'Language changed to $choice');
    }
  }
}

class LanguageSelector extends StatelessWidget {
  const LanguageSelector({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<String>(
      valueListenable: selectedLanguage,
      builder: (context, language, _) {
        return GestureDetector(
          onTap: () => showLanguagePicker(context),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.arrow_drop_down, size: 18),
              Text(
                language,
                style: const TextStyle(fontSize: 16, color: Color(0xFF171818)),
              ),
              const SizedBox(width: 4),
              const Icon(Icons.language, size: 24, color: Color(0xFF1A1B1E)),
            ],
          ),
        );
      },
    );
  }
}
