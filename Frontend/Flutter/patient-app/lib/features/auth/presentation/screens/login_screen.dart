// lib/features/auth/presentation/screens/login_screen.dart
import 'package:cms/core/constants/assets.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/constants/responsive_constants.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/core/widgets/custom_text_feild.dart';
import 'package:cms/features/auth/presentation/cubit/language_cubit.dart';
import 'package:cms/features/auth/presentation/cubit/language_state.dart';
import 'package:cms/features/auth/presentation/cubit/login_cubit.dart';
import 'package:cms/features/auth/presentation/cubit/login_state.dart';
import 'package:cms/features/auth/presentation/screens/forgot_password_screen.dart';
import 'package:cms/features/auth/presentation/screens/otp_screen.dart';
import 'package:cms/features/auth/domain/otp_session.dart';
import 'package:cms/features/home/presentation/screens/home_screen.dart';
import 'package:cms/core/notifications/push_notification_service.dart';
import 'package:cms/injection_container.dart';
import 'package:cms/core/animations/app_page_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});
  static const routeName = '/login';

  @override
  Widget build(BuildContext context) {
    final responsive = ResponsiveConstants.fromContext(context);

    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (context) => getIt<LanguageCubit>()),
        BlocProvider(create: (context) => getIt<LoginCubit>()),
      ],
      child: BlocListener<LoginCubit, LoginState>(
        listener: (context, state) {
          if (state.shouldNavigateToOtp) {
            Navigator.push(
              context,
              AppPageRoute(
                builder: (context) => OtpScreen(
                  phoneNumber: state.phoneNumber,
                  mode: OtpMode.loginMfa,
                  mfaToken: state.mfaToken,
                ),
              ),
            );
            context.read<LoginCubit>().resetNavigation();
          }
          if (state.shouldNavigateToHome) {
            getIt<PushNotificationService>().onUserAuthenticated();
            Navigator.pushNamedAndRemoveUntil(
              context,
              HomeScreen.routeName,
              (route) => false,
            );
            context.read<LoginCubit>().resetNavigation();
          }
          if (state.errorMessage != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.errorMessage!)),
            );
            context.read<LoginCubit>().clearErrors();
          }
        },
        child: Scaffold(
          backgroundColor: Colors.white,
          resizeToAvoidBottomInset: true,
          body: SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                return SingleChildScrollView(
                  physics: const ClampingScrollPhysics(),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: constraints.maxHeight,
                    ),
                    child: IntrinsicHeight(
                      child: Padding(
                        padding: const EdgeInsets.only(left: 10.0, right: 10.0),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // ---- App Bar & Header ----
                            _buildAppBar(context, responsive),
                            SizedBox(height: responsive.betweenWelcomeAndField),

                            // ---- Form Fields ----
                            _buildFormFields(context),

                            // ---- Forgot Password ----
                            _buildForgotPasswordButton(context),

                            // ---- Spacer ----
                            const Spacer(),

                            // ---- Login Button ----
                            _buildLoginButton(context),

                            // ---- Terms ----
                            _buildTermsSection(),

                            const SizedBox(height: 16),
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
      ),
    );
  }

  // ============================================================
  //  1. APP BAR & HEADER
  // ============================================================
  Widget _buildAppBar(BuildContext context, ResponsiveConstants responsive) {
    return RepaintBoundary(
      child: Column(
        children: [
          const SizedBox(height: 10),
          // ---- App Bar Row ----
          BlocBuilder<LanguageCubit, LanguageState>(
            builder: (context, languageState) {
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
                    child: Row(
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
                    ),
                  ),
                  const SizedBox(width: 8),
                  Image.asset(Assets.assetsImagesGlobe, height: 24, width: 24),
                ],
              );
            },
          ),
          // ---- Logo & Text ----
          SizedBox(height: responsive.topSpacing),
          Container(
            width: 92,
            height: 92,
            child: Image.asset(Assets.assetsImagesCrossBlue),
          ),
          SizedBox(height: responsive.betweenLogoAndWelcome),
          Text(
            "Welcome back",
            style: FontHeading.heading1.copyWith(color: AppColors.black),
          ),
          const SizedBox(height: 8),
          Text(
            "Enter your phone number \n We'll send you a verification code",
            style: FontHeading.bodyLarge.copyWith(color: AppColors.grayDark),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  // ============================================================
  //  2. FORM FIELDS (Phone + Password)
  // ============================================================
  Widget _buildFormFields(BuildContext context) {
    return RepaintBoundary(
      child: BlocBuilder<LoginCubit, LoginState>(
        builder: (context, state) {
          return Column(
            children: [
              // ---- Phone Field ----
              Padding(
                padding: const EdgeInsets.all(8.0),
                child: CustomTextField(
                  label: 'Phone number',
                  hint: '09XX XXXX XXX',
                  prefixIcon: Icons.phone_outlined,
                  keyboardType: TextInputType.phone,
                  isPhoneNumber: true,
                  errorText: state.phoneError,
                  onChanged: (value) {
                    context.read<LoginCubit>().onPhoneChanged(value);
                  },
                ),
              ),
              // ---- Password Field ----
              Padding(
                padding: const EdgeInsets.all(8.0),
                child: CustomTextField(
                  label: 'Password',
                  hint: 'Enter your password',
                  prefixIcon: Icons.lock_outlined,
                  keyboardType: TextInputType.visiblePassword,
                  obscureText: !state.isPasswordVisible,
                  errorText: state.passwordError,
                  suffixIcon: IconButton(
                    icon: Icon(
                      state.isPasswordVisible
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                      color: AppColors.customGray,
                    ),
                    onPressed: () {
                      context.read<LoginCubit>().togglePasswordVisibility();
                    },
                  ),
                  onChanged: (value) {
                    context.read<LoginCubit>().onPasswordChanged(value);
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  // ============================================================
  //  3. FORGOT PASSWORD BUTTON
  // ============================================================
  Widget _buildForgotPasswordButton(BuildContext context) {
    return RepaintBoundary(
      child: Align(
        alignment: Alignment.centerLeft,
        child: TextButton(
          onPressed: () {
            Navigator.pushNamed(context, ForgotPasswordScreen.routeName);
          },
          child: Text(
            "Forgot Password?",
            style: FontHeading.bodySmall.copyWith(
              color: AppColors.main_background_blue,
              decoration: TextDecoration.underline,
              decorationColor: AppColors.main_background_blue,
            ),
          ),
        ),
      ),
    );
  }

  // ============================================================
  //  4. LOGIN BUTTON
  // ============================================================
  Widget _buildLoginButton(BuildContext context) {
    return RepaintBoundary(
      child: BlocBuilder<LoginCubit, LoginState>(
        builder: (context, state) {
          return Padding(
            padding: const EdgeInsets.all(8.0),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: state.isValid && !state.isLoading
                    ? () => context.read<LoginCubit>().submitLogin()
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
                          valueColor: AlwaysStoppedAnimation<Color>(
                            Colors.white,
                          ),
                        ),
                      )
                    : const Text('Log in', style: FontHeading.button),
              ),
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
      child: Padding(
        padding: const EdgeInsets.only(left: 32, right: 32, bottom: 0),
        child: Wrap(
          alignment: WrapAlignment.start,
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
      ),
    );
  }
}
