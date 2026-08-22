import 'dart:async';

import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../../core/constants/app_assets.dart';
import '../../core/navigation/app_navigation.dart';
import '../../core/utils/app_dialogs.dart';
import '../../core/widgets/common_widgets.dart';
import '../../core/widgets/language_selector.dart';
import 'auth_widgets.dart';
import 'reset_password_screen.dart';

class CheckYourWhatsAppScreen extends StatefulWidget {
  const CheckYourWhatsAppScreen({super.key, required this.phoneNumber});

  final String phoneNumber;

  @override
  State<CheckYourWhatsAppScreen> createState() =>
      _CheckYourWhatsAppScreenState();
}

class _CheckYourWhatsAppScreenState extends State<CheckYourWhatsAppScreen> {
  int _seconds = 60;
  Timer? _timer;
  final _otpCtrl = TextEditingController();
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _timer?.cancel();
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

  String get _timerText {
    final m = _seconds ~/ 60;
    final s = _seconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  Future<void> _resendMessage() async {
    if (_seconds > 0) return;
    try {
      await authApi.forgotPasswordSendOtp(widget.phoneNumber);
      setState(() => _seconds = 60);
      _startTimer();
      if (mounted) showSnack(context, 'WhatsApp reset message sent again');
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    }
  }

  Future<void> _verifyOtp() async {
    final otp = _otpCtrl.text.trim();
    if (otp.length != 6) {
      showSnack(context, 'Enter the 6-digit code from WhatsApp');
      return;
    }
    setState(() => _loading = true);
    try {
      await authApi.forgotPasswordVerifyOtp(
        phoneNumber: widget.phoneNumber,
        otp: otp,
      );
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => ResetPasswordScreen(
            phoneNumber: widget.phoneNumber,
            otp: otp,
          ),
        ),
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
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Align(
                  alignment: Alignment.centerRight,
                  child: Padding(
                    padding: EdgeInsets.only(top: 16),
                    child: LanguageSelector(),
                  ),
                ),
                const SizedBox(height: 40),
                Center(child: appLogo(AppAssets.blueLogo, size: 92)),
                const SizedBox(height: 36),
                const Center(
                  child: Text(
                    'Check your WhatsApp',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1A1B1E),
                      letterSpacing: -0.5,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                RichText(
                  text: TextSpan(
                    style: const TextStyle(
                        fontSize: 18, color: Color(0xFF929296), height: 1.6),
                    children: [
                      const TextSpan(text: 'We sent a reset code on WhatsApp to '),
                      TextSpan(
                        text: widget.phoneNumber,
                        style: const TextStyle(color: Color(0xFF0B74FA)),
                      ),
                      const TextSpan(text: ', you will receive it shortly'),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: _otpCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: 'OTP code',
                    hintText: 'Enter the code',
                    border: inputBorder(const Color(0xFFB6B7B9)),
                    enabledBorder: inputBorder(const Color(0xFFB6B7B9)),
                    focusedBorder:
                        inputBorder(const Color(0xFF0B74FA), width: 2),
                  ),
                ),
                const SizedBox(height: 16),
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: const Text(
                    'Change phone number',
                    style: TextStyle(
                      fontSize: 14,
                      color: Color(0xFF0B74FA),
                      decoration: TextDecoration.underline,
                      decorationColor: Color(0xFF0B74FA),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                _seconds > 0
                    ? RichText(
                        text: TextSpan(
                          style: const TextStyle(
                              fontSize: 14, color: Color(0xFF6F7076)),
                          children: [
                            const TextSpan(text: 'Resend WhatsApp message in '),
                            TextSpan(
                              text: _timerText,
                              style: const TextStyle(
                                color: Color(0xFF0B74FA),
                                decoration: TextDecoration.underline,
                                decorationColor: Color(0xFF0B74FA),
                              ),
                            ),
                          ],
                        ),
                      )
                    : GestureDetector(
                        onTap: _resendMessage,
                        child: const Text(
                          'Resend WhatsApp message',
                          style: TextStyle(
                            fontSize: 14,
                            color: Color(0xFF0B74FA),
                            decoration: TextDecoration.underline,
                            decorationColor: Color(0xFF0B74FA),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _verifyOtp,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0B74FA),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                      elevation: 0,
                    ),
                    child: Text(
                      _loading ? 'Verifying...' : 'Verify & continue',
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                backToLoginButton(context),
                const SizedBox(height: 12),
                RichText(
                  text: TextSpan(
                    style: const TextStyle(
                        fontSize: 12, color: Color(0xFF929296)),
                    children: [
                      const TextSpan(
                        text:
                            'If you believe this is an error, please reach out to our technical support by ',
                      ),
                      TextSpan(
                        text: 'contacting with us',
                        style: const TextStyle(
                          color: Color(0xFF0B74FA),
                          decoration: TextDecoration.underline,
                          decorationColor: Color(0xFF0B74FA),
                        ),
                        recognizer: TapGestureRecognizer()
                          ..onTap = () {
                            showContactDialog(context);
                          },
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      );
}
