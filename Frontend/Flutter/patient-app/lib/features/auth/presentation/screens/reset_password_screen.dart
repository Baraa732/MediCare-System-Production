import 'package:cms/core/api/api_exception.dart';
import 'package:cms/core/api/services/auth_api_service.dart';
import 'package:cms/core/constants/assets.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/notifications/push_notification_service.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/core/utils/password_validation.dart';
import 'package:cms/core/widgets/custom_text_feild.dart';
import 'package:cms/features/auth/presentation/screens/forgot_password_otp_screen.dart';
import 'package:cms/features/home/presentation/screens/home_screen.dart';
import 'package:cms/injection_container.dart';
import 'package:flutter/material.dart';

class ResetPasswordScreen extends StatefulWidget {
  static const routeName = '/reset-password';

  const ResetPasswordScreen({super.key, required this.args});

  final ResetPasswordArgs args;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _authApi = getIt<AuthApiService>();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  bool _loading = false;
  String? _passwordError;
  String? _confirmError;

  @override
  void dispose() {
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final password = _passwordCtrl.text;
    final passwordError = validateMediCarePassword(password);
    final confirmError =
        validatePasswordConfirmation(password, _confirmCtrl.text);
    setState(() {
      _passwordError = passwordError;
      _confirmError = confirmError;
    });
    if (passwordError != null || confirmError != null) return;

    setState(() => _loading = true);
    try {
      await _authApi.resetPassword(
        phoneNumber: widget.args.phoneNumber,
        otp: widget.args.otp,
        newPassword: password,
      );
      if (!mounted) return;
      await getIt<PushNotificationService>().onUserAuthenticated();
      if (!mounted) return;
      Navigator.pushNamedAndRemoveUntil(
        context,
        HomeScreen.routeName,
        (route) => false,
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.message.contains('Invalid or expired OTP')) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Reset code expired. Please start again.'),
          ),
        );
        Navigator.pushNamedAndRemoveUntil(
          context,
          '/forgot-password',
          (route) => false,
        );
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
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
            children: [
              const SizedBox(height: 8),
              Center(
                child: Image.asset(
                  Assets.assetsImagesCrossBlue,
                  width: 92,
                  height: 92,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Reset your password',
                style: FontHeading.heading1.copyWith(color: AppColors.black),
              ),
              const SizedBox(height: 8),
              Text(
                'Choose a strong password with uppercase, lowercase, number, and special character.',
                style: FontHeading.bodyLarge.copyWith(color: AppColors.grayDark),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              CustomTextField(
                label: 'New password',
                hint: 'Enter your new password',
                prefixIcon: Icons.lock_outlined,
                keyboardType: TextInputType.visiblePassword,
                obscureText: _obscurePassword,
                errorText: _passwordError,
                controller: _passwordCtrl,
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscurePassword
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                  ),
                  onPressed: () =>
                      setState(() => _obscurePassword = !_obscurePassword),
                ),
              ),
              const SizedBox(height: 16),
              CustomTextField(
                label: 'Confirm password',
                hint: 'Confirm your password',
                prefixIcon: Icons.lock_outlined,
                keyboardType: TextInputType.visiblePassword,
                obscureText: _obscureConfirm,
                errorText: _confirmError,
                controller: _confirmCtrl,
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscureConfirm
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                  ),
                  onPressed: () =>
                      setState(() => _obscureConfirm = !_obscureConfirm),
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _loading ? null : _submit,
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
                      : const Text('Confirm password', style: FontHeading.button),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
