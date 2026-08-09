import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';

import '../../core/constants/app_assets.dart';
import '../../core/navigation/app_navigation.dart';
import '../../core/widgets/common_widgets.dart';
import '../../core/widgets/language_selector.dart';
import 'good_to_go_screen.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key, this.resetToken});

  final String? resetToken;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _newPassCtrl = TextEditingController();
  final _confirmPassCtrl = TextEditingController();
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  bool _loading = false;

  @override
  void dispose() {
    _newPassCtrl.dispose();
    _confirmPassCtrl.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    if (_newPassCtrl.text.trim().length < 6) {
      showSnack(context, 'Password must be at least 6 characters');
      return;
    }
    if (_newPassCtrl.text != _confirmPassCtrl.text) {
      showSnack(context, 'Passwords do not match');
      return;
    }
    final token = widget.resetToken;
    if (token == null || token.isEmpty) {
      showSnack(context, 'Missing reset token. Restart forgot-password flow.');
      return;
    }
    setState(() => _loading = true);
    try {
      await authApi.resetPassword(
        resetToken: token,
        newPassword: _newPassCtrl.text,
      );
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const GoodToGoScreen()),
      );
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
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
                  'Reset your Password',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1A1B1E),
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Enter a new password to reset your password',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 18, color: Color(0xFF929296), height: 1.6),
                ),
                const SizedBox(height: 40),
                TextField(
                  controller: _newPassCtrl,
                  obscureText: _obscureNew,
                  decoration: InputDecoration(
                    labelText: 'Password',
                    hintText: 'Enter your new password',
                    hintStyle: const TextStyle(color: Color(0xFFB6B7B9)),
                    prefixIcon: const Icon(Icons.lock_outline,
                        color: Color(0xFF6F7076)),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscureNew
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                        color: const Color(0xFF1A1B1E),
                      ),
                      onPressed: () =>
                          setState(() => _obscureNew = !_obscureNew),
                    ),
                    border: inputBorder(const Color(0xFFB6B7B9)),
                    enabledBorder: inputBorder(const Color(0xFFB6B7B9)),
                    focusedBorder:
                        inputBorder(const Color(0xFF0B74FA), width: 2),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _confirmPassCtrl,
                  obscureText: _obscureConfirm,
                  decoration: InputDecoration(
                    labelText: 'Confirm Password',
                    hintText: 'Confirm your password',
                    hintStyle: const TextStyle(color: Color(0xFFB6B7B9)),
                    prefixIcon: const Icon(Icons.lock_outline,
                        color: Color(0xFF6F7076)),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscureConfirm
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                        color: const Color(0xFF1A1B1E),
                      ),
                      onPressed: () =>
                          setState(() => _obscureConfirm = !_obscureConfirm),
                    ),
                    border: inputBorder(const Color(0xFFB6B7B9)),
                    enabledBorder: inputBorder(const Color(0xFFB6B7B9)),
                    focusedBorder:
                        inputBorder(const Color(0xFF0B74FA), width: 2),
                  ),
                ),
                const SizedBox(height: 200),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _confirm,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0B74FA),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                      elevation: 0,
                    ),
                    child: Text(
                      _loading ? 'Saving...' : 'Confirm Password',
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      );
}
