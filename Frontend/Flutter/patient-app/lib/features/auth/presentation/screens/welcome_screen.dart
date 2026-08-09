// features/welcome/presentation/screens/welcome_screen.dart
import 'package:cms/core/constants/assets.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/features/auth/presentation/cubit/language_cubit.dart';
import 'package:cms/features/auth/presentation/cubit/language_state.dart';
import 'package:cms/injection_container.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});
  static String routeName = '/welcome';

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => getIt<LanguageCubit>(),
      child: Scaffold(
        backgroundColor: Colors.white,
        body: BlocBuilder<LanguageCubit, LanguageState>(
          builder: (context, state) {
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    children: [
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.arrow_drop_down,
                                  color: AppColors.black,
                                ),
                                const SizedBox(width: 4),
                                DropdownButton<String>(
                                  value: state.selectedLanguage,
                                  icon: const SizedBox(),
                                  underline: const SizedBox(),
                                  style: FontHeading.body.copyWith(
                                    color: AppColors.black,
                                  ),
                                  items: state.languages.map((String language) {
                                    return DropdownMenuItem<String>(
                                      value: language,
                                      child: Text(language),
                                    );
                                  }).toList(),
                                  onChanged: (String? newValue) {
                                    if (newValue != null) {
                                      context
                                          .read<LanguageCubit>()
                                          .changeLanguage(newValue);
                                    }
                                  },
                                ),
                              ],
                            ),
                          ),
                          SizedBox(width: 8),
                          Image.asset(
                            Assets.assetsImagesGlobe,
                            height: 24,
                            width: 24,
                          ),
                        ],
                      ),
                      SizedBox(height: 109),
                      Container(
                        width: 92,
                        height: 92,
                        child: Image.asset(Assets.assetsImagesCrossBlue),
                      ),
                      const SizedBox(height: 52),
                      Text(
                        "Your trusted medical appointment portal",
                        style: FontHeading.heading1.copyWith(
                          color: AppColors.black,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "Some splash text in here depending on what we decide later",
                        style: FontHeading.bodyLarge.copyWith(
                          color: AppColors.grayDark,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    children: [
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () {
                            Navigator.pushNamed(context, '/login');
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.main_background_blue,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                          child: const Text(
                            'Log in',
                            style: FontHeading.button,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () {
                            Navigator.pushNamed(context, '/signup');
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.main_background_blue
                                .withOpacity(0.1),
                            foregroundColor: AppColors.main_background_blue,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                            elevation: 0,
                            shadowColor: Colors.transparent,
                            overlayColor: Colors.transparent,
                          ),
                          child: Text(
                            'Create an account',
                            style: FontHeading.button.copyWith(
                              color: AppColors.main_background_blue,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextButton(
                        onPressed: () {
                          Navigator.pushNamed(context, '/home');
                        },
                        style: TextButton.styleFrom(
                          foregroundColor: AppColors.main_background_blue,
                        ),
                        child: Text(
                          'Continue as a guest',
                          style: FontHeading.button.copyWith(
                            color: AppColors.main_background_blue,
                            decoration: TextDecoration.underline,
                            decorationColor: AppColors.main_background_blue,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
