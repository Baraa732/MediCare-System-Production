import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';

import '../../core/constants/app_assets.dart';
import '../../core/navigation/app_navigation.dart';
import '../../core/widgets/common_widgets.dart';
import '../../core/widgets/language_selector.dart';
import 'check_your_whatsapp_screen.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _phoneCtrl = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final phone = _phoneCtrl.text.trim();
    if (phone.isEmpty) {
      showSnack(context, 'Please enter your phone number');
      return;
    }
    setState(() => _loading = true);
    try {
      await authApi.forgotPasswordSendOtp(phone);
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => CheckYourWhatsAppScreen(phoneNumber: phone),
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
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      GestureDetector(
                        onTap: () => Navigator.pop(context),
                        child: const Row(children: [
                          Icon(Icons.arrow_back,
                              size: 14, color: Color(0xFF1A1B1E)),
                          SizedBox(width: 6),
                          Text('Back',
                              style: TextStyle(
                                  fontSize: 16, color: Color(0xFF171818))),
                        ]),
                      ),
                      const LanguageSelector(),
                    ],
                  ),
                ),
                const SizedBox(height: 40),
                appLogo(AppAssets.blueLogo, size: 92),
                const SizedBox(height: 36),
                const Text(
                  'Forgot password?',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1A1B1E),
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Enter your phone number and we\'ll send you a WhatsApp message to reset your password',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 18, color: Color(0xFF929296), height: 1.6),
                ),
                const SizedBox(height: 40),
                TextField(
                  controller: _phoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText: 'Phone number',
                    hintText: 'Enter your phone number',
                    hintStyle: const TextStyle(color: Color(0xFFB6B7B9)),
                    prefixIcon: const Icon(Icons.phone_outlined,
                        color: Color(0xFF6F7076)),
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
                    onPressed: _loading ? null : _send,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0B74FA),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                      elevation: 0,
                    ),
                    child: Text(
                      _loading ? 'Sending...' : 'Send via WhatsApp',
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
