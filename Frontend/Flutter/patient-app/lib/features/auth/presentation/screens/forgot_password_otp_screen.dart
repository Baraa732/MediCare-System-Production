import 'dart:async';

import 'package:cms/core/api/api_exception.dart';
import 'package:cms/core/api/services/auth_api_service.dart';
import 'package:cms/core/constants/assets.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/core/widgets/custom_text_feild.dart';
import 'package:cms/features/auth/presentation/screens/reset_password_screen.dart';
import 'package:cms/injection_container.dart';
import 'package:flutter/material.dart';

class ForgotPasswordOtpScreen extends StatefulWidget {
  static const routeName = '/forgot-password-otp';

  const ForgotPasswordOtpScreen({super.key, required this.phoneNumber});

  final String phoneNumber;

  @override
  State<ForgotPasswordOtpScreen> createState() =>
      _ForgotPasswordOtpScreenState();
}

class _ForgotPasswordOtpScreenState extends State<ForgotPasswordOtpScreen> {
  final _otpCtrl = TextEditingController();
  final _authApi = getIt<AuthApiService>();
  int _seconds = 60;
  Timer? _timer;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _timer?.cancel();
    _seconds = 60;
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_seconds == 0) {
        t.cancel();
      } else {
        setState(() => _seconds--);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _otpCtrl.dispose();
    super.dispose();
  }

  Future<void> _resend() async {
    if (_seconds > 0) return;
    try {
      await _authApi.forgotPasswordSendOtp(widget.phoneNumber);
      _startTimer();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('WhatsApp code sent again')),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    }
  }

  Future<void> _verify() async {
    final otp = _otpCtrl.text.trim();
    if (otp.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter the 6-digit code from WhatsApp')),
      );
      return;
    }
    setState(() => _loading = true);
    try {
      await _authApi.forgotPasswordVerifyOtp(
        phoneNumber: widget.phoneNumber,
        otp: otp,
      );
      if (!mounted) return;
      Navigator.pushNamed(
        context,
        ResetPasswordScreen.routeName,
        arguments: ResetPasswordArgs(
          phoneNumber: widget.phoneNumber,
          otp: otp,
        ),
      );
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.arrow_back),
              ),
              Center(
                child: Image.asset(
                  Assets.assetsImagesCrossBlue,
                  width: 92,
                  height: 92,
                ),
              ),
              const SizedBox(height: 24),
              Center(
                child: Text(
                  'Check your WhatsApp',
                  style: FontHeading.heading1.copyWith(color: AppColors.black),
                ),
              ),
              const SizedBox(height: 8),
              Center(
                child: RichText(
                  textAlign: TextAlign.center,
                  text: TextSpan(
                    style: FontHeading.bodyLarge.copyWith(
                      color: AppColors.grayDark,
                    ),
                    children: [
                      const TextSpan(text: 'We sent a reset code to '),
                      TextSpan(
                        text: widget.phoneNumber,
                        style: const TextStyle(color: AppColors.main_background_blue),
                      ),
                      const TextSpan(text: '. Enter it below.'),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              CustomTextField(
                label: 'Verification code',
                hint: '6-digit code',
                prefixIcon: Icons.sms_outlined,
                keyboardType: TextInputType.number,
                controller: _otpCtrl,
              ),
              const SizedBox(height: 12),
              if (_seconds > 0)
                Text(
                  'Resend code in $_seconds s',
                  style: FontHeading.bodySmall.copyWith(
                    color: AppColors.grayDark,
                  ),
                )
              else
                TextButton(
                  onPressed: _resend,
                  child: Text(
                    'Resend WhatsApp code',
                    style: FontHeading.bodySmall.copyWith(
                      color: AppColors.main_background_blue,
                    ),
                  ),
                ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _loading ? null : _verify,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.main_background_blue,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: _loading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation(Colors.white),
                          ),
                        )
                      : const Text('Verify & continue', style: FontHeading.button),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ResetPasswordArgs {
  const ResetPasswordArgs({required this.phoneNumber, required this.otp});

  final String phoneNumber;
  final String otp;
}
