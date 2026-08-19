import 'package:cms_doctor_app/features/schedule/day_view_screen.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';

import '../../core/constants/app_assets.dart';
import '../../core/navigation/app_navigation.dart';
import '../../core/widgets/common_widgets.dart';
import '../../core/widgets/language_selector.dart';

/// First-login password setup after MFA (`/auth/staff/complete-activation`).
class ActivateAccountScreen extends StatefulWidget {
  const ActivateAccountScreen({super.key, required this.activationToken});

  final String activationToken;

  @override
  State<ActivateAccountScreen> createState() => _ActivateAccountScreenState();
}

class _ActivateAccountScreenState extends State<ActivateAccountScreen> {
  final _newPassCtrl = TextEditingController();
  final _confirmPassCtrl = TextEditingController();
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  bool _loading = false;

  static final _passwordPattern = RegExp(
    r'''^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$''',
  );

  @override
  void dispose() {
    _newPassCtrl.dispose();
    _confirmPassCtrl.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    final password = _newPassCtrl.text;
    if (!_passwordPattern.hasMatch(password)) {
      showSnack(
        context,
        'Password must be 8+ chars with upper, lower, number, and special character',
      );
      return;
    }
    if (password != _confirmPassCtrl.text) {
      showSnack(context, 'Passwords do not match');
      return;
    }

    setState(() => _loading = true);
    try {
      await authApi.completeStaffActivation(
        activationToken: widget.activationToken,
        newPassword: password,
      );
      await pushNotificationService.onUserAuthenticated();
      if (!mounted) return;
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const DayViewScreen()),
        (_) => false,
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
                  'Set your password',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1A1B1E),
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Create a permanent password to finish activating your doctor account',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    color: Color(0xFF929296),
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 40),
                TextField(
                  controller: _newPassCtrl,
                  obscureText: _obscureNew,
                  decoration: InputDecoration(
                    labelText: 'New password',
                    hintText: 'Enter a strong password',
                    hintStyle: const TextStyle(color: Color(0xFFB6B7B9)),
                    prefixIcon: const Icon(
                      Icons.lock_outline,
                      color: Color(0xFF6F7076),
                    ),
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
                    labelText: 'Confirm password',
                    hintText: 'Re-enter your password',
                    hintStyle: const TextStyle(color: Color(0xFFB6B7B9)),
                    prefixIcon: const Icon(
                      Icons.lock_outline,
                      color: Color(0xFF6F7076),
                    ),
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
                const SizedBox(height: 12),
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Use at least 8 characters with uppercase, lowercase, a number, and a special character.',
                    style: TextStyle(fontSize: 13, color: Color(0xFF929296)),
                  ),
                ),
                const SizedBox(height: 48),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _confirm,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0B74FA),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      elevation: 0,
                    ),
                    child: Text(
                      _loading ? 'Activating...' : 'Activate account',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
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
