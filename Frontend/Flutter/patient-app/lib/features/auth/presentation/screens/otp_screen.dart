// lib/features/auth/presentation/screens/otp_screen.dart
import 'package:cms/core/constants/assets.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/constants/responsive_constants.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/features/auth/presentation/cubit/language_cubit.dart';
import 'package:cms/features/auth/presentation/cubit/language_state.dart';
import 'package:cms/core/api/services/auth_api_service.dart';
import 'package:cms/features/auth/domain/otp_session.dart';
import 'package:cms/features/auth/presentation/cubit/otp_cubit.dart';
import 'package:cms/features/auth/presentation/cubit/otp_state.dart';
import 'package:cms/features/home/presentation/screens/home_screen.dart';
import 'package:cms/core/notifications/push_notification_service.dart';
import 'package:cms/injection_container.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class OtpScreen extends StatelessWidget {
  static const routeName = '/otp';
  final String phoneNumber;
  final OtpMode mode;
  final String? mfaToken;

  const OtpScreen({
    super.key,
    this.phoneNumber = '',
    this.mode = OtpMode.signupVerify,
    this.mfaToken,
  });

  @override
  Widget build(BuildContext context) {
    final responsive = ResponsiveConstants.fromContext(context);
    final session = OtpSession(
      phoneNumber: phoneNumber,
      mode: mode,
      mfaToken: mfaToken,
    );
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (context) => getIt<LanguageCubit>()),
        BlocProvider(
          create: (context) => OtpCubit(
            session: session,
            authApi: getIt<AuthApiService>(),
          ),
        ),
      ],
      child: BlocListener<OtpCubit, OtpState>(
        listener: (context, state) {
          if (state.shouldNavigateToHome) {
            getIt<PushNotificationService>().onUserAuthenticated();
            Navigator.pushNamedAndRemoveUntil(
              context,
              HomeScreen.routeName,
              (route) => false,
            );
            context.read<OtpCubit>().resetNavigation();
          }
          if (state.errorMessage != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.errorMessage!)),
            );
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
                  constraints: BoxConstraints(minHeight: constraints.maxHeight),
                  child: IntrinsicHeight(
                    child: Padding(
                      padding: const EdgeInsets.only(
                        left: 8,
                        right: 16,
                        top: 8,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          // ---- App Bar ----
                          _buildAppBar(context),

                          // ---- Logo, Title, Subtitle ----
                          _buildHeaderSection(context, responsive),

                          SizedBox(height: responsive.betweenSubAndField),

                          // ---- OTP Input & Resend Timer ----
                          _buildOtpSection(context),

                          const Spacer(),

                          // ---- Verify Button ----
                          _buildVerifyButton(context),

                          const SizedBox(height: 16),

                          // ---- Terms ----
                          _buildTermsSection(),

                          const SizedBox(height: 20),
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
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
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
                      value: langState.selectedLanguage,
                      icon: const SizedBox(),
                      underline: const SizedBox(),
                      style: FontHeading.body.copyWith(color: Colors.black),
                      items: langState.languages.map((String language) {
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
          SizedBox(height: responsive.topSpacing),
          Container(
            width: 92,
            height: 92,
            child: Image.asset(Assets.assetsImagesCrossBlue),
          ),
          SizedBox(height: responsive.betweenLogoAndWelcome),
          Text(
            "Verify your account",
            style: FontHeading.heading1.copyWith(color: AppColors.black),
          ),
          SizedBox(height: responsive.betweenTitleAndSub),
          Text(
            "We sent a verification code\n to ${_formatPhoneNumber(phoneNumber)}",
            style: FontHeading.bodyLarge.copyWith(color: AppColors.grayDark),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  // ============================================================
  //  3. OTP SECTION (Input + Resend Timer)
  // ============================================================
  Widget _buildOtpSection(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          // OTP Input
          RepaintBoundary(
            child: BlocBuilder<OtpCubit, OtpState>(
              builder: (context, state) {
                return _buildOtpInput(context);
              },
            ),
          ),
          const SizedBox(height: 16),
          // Resend Timer
          _buildResendTimer(context),
        ],
      ),
    );
  }

  // ============================================================
  //  3a. OTP INPUT (6 digits)
  // ============================================================
  Widget _buildOtpInput(BuildContext context) {
    return BlocBuilder<OtpCubit, OtpState>(
      builder: (context, state) {
        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: List.generate(6, (index) {
            return SizedBox(
              width: 48,
              height: 56,
              child: TextField(
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                maxLength: 1,
                style: FontHeading.heading1.copyWith(
                  fontSize: 24,
                  color: Colors.black,
                ),
                decoration: InputDecoration(
                  counterText: '',
                  filled: true,
                  fillColor: AppColors.main_background_white,
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(
                      color: AppColors.customGray,
                      width: 1,
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(
                      color: AppColors.main_background_blue,
                      width: 2,
                    ),
                  ),
                  errorBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: Colors.red, width: 1),
                  ),
                  contentPadding: const EdgeInsets.all(0),
                ),
                onChanged: (value) {
                  String currentCode = state.otpCode;
                  List<String> chars = currentCode.split('');

                  if (value.isNotEmpty) {
                    if (index < chars.length) {
                      chars[index] = value;
                    } else {
                      chars.add(value);
                    }
                  } else {
                    if (index < chars.length) {
                      chars.removeAt(index);
                    }
                  }

                  final updated = chars.join();
                  context.read<OtpCubit>().onOtpChanged(updated);

                  if (value.isNotEmpty && index < 5) {
                    FocusScope.of(context).nextFocus();
                  }
                },
              ),
            );
          }),
        );
      },
    );
  }

  // ============================================================
  //  3b. RESEND TIMER
  // ============================================================
  Widget _buildResendTimer(BuildContext context) {
    return RepaintBoundary(
      child: BlocBuilder<OtpCubit, OtpState>(
        builder: (context, state) {
          return Row(
            children: [
              Text(
                "Resend code in ",
                style: FontHeading.bodySmall.copyWith(
                  color: AppColors.grayDark,
                ),
              ),
              Text(
                _formatTimer(state.resendTimer),
                style: FontHeading.bodySmall.copyWith(
                  color: AppColors.main_background_blue,
                  decoration: TextDecoration.underline,
                  decorationColor: AppColors.main_background_blue,
                ),
              ),
              if (state.resendTimer == 0)
                TextButton(
                  onPressed: () {
                    context.read<OtpCubit>().resendCode();
                  },
                  child: Text(
                    "Resend",
                    style: FontHeading.bodySmall.copyWith(
                      color: AppColors.main_background_blue,
                      decoration: TextDecoration.underline,
                      decorationColor: AppColors.main_background_blue,
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  // ============================================================
  //  4. VERIFY BUTTON
  // ============================================================
  Widget _buildVerifyButton(BuildContext context) {
    return RepaintBoundary(
      child: BlocBuilder<OtpCubit, OtpState>(
        builder: (context, state) {
          return SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: state.isValid && !state.isLoading
                  ? () => context.read<OtpCubit>().verifyOtp()
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
                  : const Text("Verify", style: FontHeading.button),
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

  // ============================================================
  //  HELPERS
  // ============================================================
  String _formatTimer(int seconds) {
    final minutes = seconds ~/ 60;
    final secs = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  String _formatPhoneNumber(String phone) {
    final digits = phone.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.startsWith('0')) {
      return '+963${digits.substring(1)}';
    }
    if (digits.startsWith('963')) {
      return '+$digits';
    }
    return phone;
  }
}
