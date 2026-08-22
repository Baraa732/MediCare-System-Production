import 'package:cms/core/constants/assets.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/constants/responsive_constants.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/core/widgets/custom_text_feild.dart';
import 'package:cms/features/auth/presentation/cubit/forgot_password_cubit.dart';
import 'package:cms/features/auth/presentation/cubit/forgot_password_state.dart';
import 'package:cms/features/auth/presentation/cubit/language_cubit.dart';
import 'package:cms/features/auth/presentation/cubit/language_state.dart';
import 'package:cms/features/auth/presentation/screens/forgot_password_otp_screen.dart';
import 'package:cms/injection_container.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class ForgotPasswordScreen extends StatelessWidget {
  static const routeName = '/forgot-password';

  const ForgotPasswordScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final responsive = ResponsiveConstants.fromContext(context);

    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (_) => getIt<LanguageCubit>()),
        BlocProvider(create: (_) => getIt<ForgotPasswordCubit>()),
      ],
      child: BlocListener<ForgotPasswordCubit, ForgotPasswordState>(
        listener: (context, state) {
          if (state.shouldNavigateToOtp) {
            Navigator.pushNamed(
              context,
              ForgotPasswordOtpScreen.routeName,
              arguments: state.phoneNumber.trim(),
            );
            context.read<ForgotPasswordCubit>().resetNavigation();
          }
          if (state.errorMessage != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.errorMessage!)),
            );
          }
        },
        child: Scaffold(
          backgroundColor: Colors.white,
          body: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildAppBar(context),
                  SizedBox(height: responsive.topSpacing),
                  Center(
                    child: Image.asset(
                      Assets.assetsImagesCrossBlue,
                      width: 92,
                      height: 92,
                    ),
                  ),
                  SizedBox(height: responsive.betweenLogoAndWelcome),
                  Center(
                    child: Text(
                      'Forgot password?',
                      style: FontHeading.heading1.copyWith(
                        color: AppColors.black,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Center(
                    child: Text(
                      'Enter your phone number and we\'ll send a WhatsApp code to reset your password.',
                      style: FontHeading.bodyLarge.copyWith(
                        color: AppColors.grayDark,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  SizedBox(height: responsive.betweenWelcomeAndField),
                  BlocBuilder<ForgotPasswordCubit, ForgotPasswordState>(
                    builder: (context, state) {
                      return CustomTextField(
                        label: 'Phone number',
                        hint: 'Enter your phone number',
                        prefixIcon: Icons.phone_outlined,
                        keyboardType: TextInputType.phone,
                        errorText: state.phoneError,
                        onChanged: (value) {
                          context.read<ForgotPasswordCubit>().onPhoneChanged(value);
                        },
                      );
                    },
                  ),
                  const SizedBox(height: 32),
                  BlocBuilder<ForgotPasswordCubit, ForgotPasswordState>(
                    builder: (context, state) {
                      return SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: state.isLoading
                              ? null
                              : () => context
                                  .read<ForgotPasswordCubit>()
                                  .sendResetOtp(),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.main_background_blue,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                          child: state.isLoading
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor:
                                        AlwaysStoppedAnimation(Colors.white),
                                  ),
                                )
                              : const Text(
                                  'Send via WhatsApp',
                                  style: FontHeading.button,
                                ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAppBar(BuildContext context) {
    return Row(
      children: [
        IconButton(
          onPressed: () => Navigator.pop(context),
          icon: const Icon(Icons.arrow_back),
        ),
        Text('Back', style: FontHeading.body.copyWith(color: Colors.black)),
        const Spacer(),
        BlocBuilder<LanguageCubit, LanguageState>(
          builder: (context, languageState) {
            return DropdownButton<String>(
              value: languageState.selectedLanguage,
              underline: const SizedBox(),
              style: FontHeading.body.copyWith(color: Colors.black),
              items: languageState.languages
                  .map((lang) => DropdownMenuItem(value: lang, child: Text(lang)))
                  .toList(),
              onChanged: (value) {
                if (value != null) {
                  context.read<LanguageCubit>().changeLanguage(value);
                }
              },
            );
          },
        ),
        Image.asset(Assets.assetsImagesGlobe, height: 24, width: 24),
      ],
    );
  }
}
