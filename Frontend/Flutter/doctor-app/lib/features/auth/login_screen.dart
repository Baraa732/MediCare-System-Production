import 'package:cms_doctor_app/features/auth/no_clinic_access_screen.dart';
import 'package:cms_doctor_app/features/schedule/day_view_screen.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';

import '../../core/constants/app_assets.dart';
import '../../core/navigation/app_navigation.dart';
import '../../core/utils/app_dialogs.dart';
import '../../core/widgets/common_widgets.dart';
import '../../core/widgets/language_selector.dart';
import 'forgot_password_screen.dart';
import 'verification_code_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _obscure = true;
  bool _loading = false;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (_phoneCtrl.text.trim().isEmpty || _passCtrl.text.trim().isEmpty) {
      showSnack(context, 'Please enter your phone number and password');
      return;
    }
    setState(() => _loading = true);
    try {
      final result = await authApi.login(
        phoneNumber: _phoneCtrl.text.trim(),
        password: _passCtrl.text,
      );
      if (!mounted) return;
      if (result.errorCode == 'NOT_DOCTOR') {
        showSnack(context, 'This app is for doctors only');
        return;
      }
      if (result.errorCode == 'NO_CLINIC') {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const NoClinicAccessScreen()),
        );
        return;
      }
      if (result.requiresMfa) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => VerificationCodeScreen(
              mfaToken: result.mfaToken ?? '',
              phoneNumber: _phoneCtrl.text.trim(),
            ),
          ),
        );
        return;
      }
      if (result.session != null) {
        await pushNotificationService.onUserAuthenticated();
        if (!mounted) return;
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const DayViewScreen()),
        );
      }
    } catch (e) {
      if (!mounted) return;
      showSnack(context, e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              children: [
                const Align(
                  alignment: Alignment.centerRight,
                  child: Padding(
                    padding: EdgeInsets.only(top: 16),
                    child: LanguageSelector(),
                  ),
                ),
                const SizedBox(height: 40),
                appLogo(AppAssets.blueLogo, size: 92),
                const SizedBox(height: 36),
                const Text(
                  'Log in',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1A1B1E),
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Please login to continue\nto the doctors app',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 18, color: Color(0xFF929296), height: 1.6),
                ),
                const SizedBox(height: 40),
                TextField(
                  controller: _phoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText: 'Phone number',
                    hintText: 'Enter your phone number',
                    hintStyle: const TextStyle(color: Color(0xFFB6B7B9)),
                    prefixIcon: const Icon(Icons.phone_outlined, color: Color(0xFF6F7076)),
                    border: inputBorder(const Color(0xFFB6B7B9)),
                    enabledBorder: inputBorder(const Color(0xFFB6B7B9)),
                    focusedBorder: inputBorder(const Color(0xFF0B74FA), width: 2),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _passCtrl,
                  obscureText: _obscure,
                  decoration: InputDecoration(
                    labelText: 'Password',
                    hintText: 'Enter your password',
                    hintStyle: const TextStyle(color: Color(0xFFB6B7B9)),
                    prefixIcon: const Icon(Icons.lock_outline, color: Color(0xFF6F7076)),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                        color: const Color(0xFF1A1B1E),
                      ),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                    border: inputBorder(const Color(0xFFB6B7B9)),
                    enabledBorder: inputBorder(const Color(0xFFB6B7B9)),
                    focusedBorder: inputBorder(const Color(0xFF0B74FA), width: 2),
                  ),
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton(
                    onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const ForgotPasswordScreen()),
                    ),
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text(
                      'Forgot password?',
                      style: TextStyle(
                        color: Color(0xFF0B74FA),
                        decoration: TextDecoration.underline,
                        decorationColor: Color(0xFF0B74FA),
                        fontSize: 12,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 120),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _login,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0B74FA),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      elevation: 0,
                    ),
                    child: _loading
                        ? const SizedBox(
                            height: 22,
                            width: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Log in',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                          ),
                  ),
                ),
                const SizedBox(height: 16),
                Wrap(
                  alignment: WrapAlignment.center,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    const Text(
                      'By continuing, you agree to our ',
                      style: TextStyle(fontSize: 12, color: Color(0xFF1A1B1E)),
                    ),
                    TextButton(
                      onPressed: () => showTermsDialog(context),
                      style: TextButton.styleFrom(
                        padding: EdgeInsets.zero,
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: const Text(
                        'Terms of Service',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF0B74FA),
                          decoration: TextDecoration.underline,
                          decorationColor: Color(0xFF0B74FA),
                        ),
                      ),
                    ),
                    const Text(' and ', style: TextStyle(fontSize: 12, color: Color(0xFF1A1B1E))),
                    TextButton(
                      onPressed: () => showPrivacyDialog(context),
                      style: TextButton.styleFrom(
                        padding: EdgeInsets.zero,
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: const Text(
                        'Privacy Policy',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF0B74FA),
                          decoration: TextDecoration.underline,
                          decorationColor: Color(0xFF0B74FA),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      );
}
