// lib/features/auth/presentation/screens/forgot_password_screen.dart
import 'package:cms/core/constants/assets.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/constants/responsive_constants.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/core/widgets/custom_text_feild.dart';
import 'package:cms/features/auth/presentation/cubit/forgot_password_cubit.dart';
import 'package:cms/features/auth/presentation/cubit/forgot_password_state.dart';
import 'package:cms/features/auth/presentation/cubit/language_cubit.dart';
import 'package:cms/features/auth/presentation/cubit/language_state.dart';
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
        BlocProvider(create: (context) => getIt<LanguageCubit>()),
        BlocProvider(create: (context) => getIt<ForgotPasswordCubit>()),
      ],
      child: Scaffold(
        backgroundColor: Colors.white,
        resizeToAvoidBottomInset: true,
        body: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              return SingleChildScrollView(
                physics: const ClampingScrollPhysics(),
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight),
                  child: IntrinsicHeight(
                    child: Padding(
                      padding: const EdgeInsets.only(
                        left: 10.0,
                        right: 10.0,
                        bottom: 8.0,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // ---- App Bar & Header ----
                          _buildAppBar(context),
                          SizedBox(height: responsive.topSpacing),
                          _buildHeaderSection(context, responsive),
                          SizedBox(height: responsive.betweenSubAndField - 30),

                          // ---- Form Fields ----
                          _buildFormFields(context),

                          const Spacer(),

                          // ---- Submit Button ----
                          _buildSubmitButton(context),

                          const SizedBox(height: 16),

                          // ---- Terms ----
                          Center(child: _buildTermsSection()),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  // ============================================================
  //  1. APP BAR
  // ============================================================
  Widget _buildAppBar(BuildContext context) {
    return RepaintBoundary(
      child: BlocBuilder<LanguageCubit, LanguageState>(
        builder: (context, langState) {
          return Row(
            children: [
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.arrow_back),
              ),
              Text(
                "Back",
                style: FontHeading.body.copyWith(color: Colors.black),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: BlocBuilder<LanguageCubit, LanguageState>(
                  builder: (context, languageState) {
                    return Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.arrow_drop_down, color: Colors.black),
                        const SizedBox(width: 4),
                        DropdownButton<String>(
                          value: languageState.selectedLanguage,
                          icon: const SizedBox(),
                          underline: const SizedBox(),
                          style: FontHeading.body.copyWith(color: Colors.black),
                          items: languageState.languages.map((String language) {
                            return DropdownMenuItem<String>(
                              value: language,
                              child: Text(language),
                            );
                          }).toList(),
                          onChanged: (String? newValue) {
                            if (newValue != null) {
                              context.read<LanguageCubit>().changeLanguage(
                                newValue,
                              );
                            }
                          },
                        ),
                      ],
                    );
                  },
                ),
              ),
              const SizedBox(width: 8),
              Image.asset(Assets.assetsImagesGlobe, height: 24, width: 24),
            ],
          );
        },
      ),
    );
  }

  // ============================================================
  //  2. HEADER SECTION (Logo, Title, Subtitle)
  // ============================================================
  Widget _buildHeaderSection(
    BuildContext context,
    ResponsiveConstants responsive,
  ) {
    return RepaintBoundary(
      child: Column(
        children: [
          Center(
            child: Container(
              width: 92,
              height: 92,
              child: Image.asset(Assets.assetsImagesCrossBlue),
            ),
          ),
          SizedBox(height: responsive.betweenLogoAndWelcome),
          Center(
            child: Text(
              "Create a password",
              style: FontHeading.heading1.copyWith(color: AppColors.black),
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: Text(
              "Enter a password\nmake sure to remember it",
              style: FontHeading.bodyLarge.copyWith(color: AppColors.grayDark),
              textAlign: TextAlign.center,
            ),
          ),
          SizedBox(height: responsive.betweenWelcomeAndField),
        ],
      ),
    );
  }

  // ============================================================
  //  3. FORM FIELDS (Password + Confirm Password)
  // ============================================================
  Widget _buildFormFields(BuildContext context) {
    return RepaintBoundary(
      child: BlocBuilder<ForgotPasswordCubit, ForgotPasswordState>(
        builder: (context, state) {
          return Column(
            children: [
              // Password Field
              CustomTextField(
                label: 'Password',
                hint: 'Create your password',
                prefixIcon: Icons.lock_outlined,
                keyboardType: TextInputType.visiblePassword,
                obscureText: !state.isPasswordVisible,
                errorText: state.passwordError,
                suffixIcon: IconButton(
                  icon: Icon(
                    state.isPasswordVisible
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                    color: AppColors.black,
                  ),
                  onPressed: () {
                    context
                        .read<ForgotPasswordCubit>()
                        .togglePasswordVisibility();
                  },
                ),
                onChanged: (value) {
                  context.read<ForgotPasswordCubit>().onPasswordChanged(value);
                },
              ),
              const SizedBox(height: 16),
              // Confirm Password Field
              CustomTextField(
                label: 'Confirm Password',
                hint: 'Confirm your password',
                prefixIcon: Icons.lock_outlined,
                keyboardType: TextInputType.visiblePassword,
                obscureText: !state.isConfirmPasswordVisible,
                errorText: state.confirmPasswordError,
                suffixIcon: IconButton(
                  icon: Icon(
                    state.isConfirmPasswordVisible
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                    color: AppColors.black,
                  ),
                  onPressed: () {
                    context
                        .read<ForgotPasswordCubit>()
                        .toggleConfirmPasswordVisibility();
                  },
                ),
                onChanged: (value) {
                  context.read<ForgotPasswordCubit>().onConfirmPasswordChanged(
                    value,
                  );
                },
              ),
            ],
          );
        },
      ),
    );
  }

  // ============================================================
  //  4. SUBMIT BUTTON
  // ============================================================
  Widget _buildSubmitButton(BuildContext context) {
    return RepaintBoundary(
      child: BlocBuilder<ForgotPasswordCubit, ForgotPasswordState>(
        builder: (context, state) {
          return SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: state.isValid && !state.isLoading
                  ? () {
                      context.read<ForgotPasswordCubit>().submitNewPassword();
                    }
                  : null,
              style: ElevatedButton.styleFrom(
                disabledBackgroundColor: AppColors.main_background_blue
                    .withOpacity(0.2),
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
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : const Text('Create account', style: FontHeading.button),
            ),
          );
        },
      ),
    );
  }

  // ============================================================
  //  5. TERMS SECTION
  // ============================================================
  Widget _buildTermsSection() {
    return RepaintBoundary(
      child: Wrap(
        alignment: WrapAlignment.center,
        children: [
          Text(
            "By continuing, you agree to our ",
            style: FontHeading.caption.copyWith(color: AppColors.grayDark),
          ),
          GestureDetector(
            onTap: () {},
            child: Text(
              "Terms of Service",
              style: FontHeading.caption.copyWith(
                color: AppColors.main_background_blue,
                decoration: TextDecoration.underline,
                decorationColor: AppColors.main_background_blue,
              ),
            ),
          ),
          Text(
            " and ",
            style: FontHeading.caption.copyWith(color: AppColors.grayDark),
          ),
          GestureDetector(
            onTap: () {},
            child: Text(
              "Privacy Policy",
              style: FontHeading.caption.copyWith(
                color: AppColors.main_background_blue,
                decoration: TextDecoration.underline,
                decorationColor: AppColors.main_background_blue,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
