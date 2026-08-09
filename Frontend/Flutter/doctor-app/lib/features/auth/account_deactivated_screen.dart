import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/constants/app_assets.dart';
import '../../core/navigation/app_navigation.dart';
import '../../core/utils/app_dialogs.dart';
import 'auth_widgets.dart';

class AccountDeactivatedScreen extends StatelessWidget {
  const AccountDeactivatedScreen({super.key});

  void _contactAdmin(BuildContext context) {
    showSnack(context, 'Opening WhatsApp chat with clinic administrator');
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              children: [
                const SizedBox(height: 60),
                Center(child: SvgPicture.asset(AppAssets.accountDeactivated, width: 92, height: 92)),
                const SizedBox(height: 36),
                const Text(
                  'Account Deactivated',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600, color: Color(0xFF1A1B1E)),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Your account has been deactivated, please contact your clinic administrator to reactivate your account',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 18, color: Color(0xFF929296), height: 1.6),
                ),
                const SizedBox(height: 24),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0B74FA).withValues(alpha: 0.05),
                    border: Border.all(color: const Color(0xFF0B74FA)),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    children: [
                      const Icon(Icons.chat_outlined, color: Color(0xFF0B74FA), size: 32),
                      const SizedBox(height: 8),
                      const Text(
                        'Contact your clinic administrator on WhatsApp:',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 16, color: Color(0xFF1A1B1E)),
                      ),
                      const SizedBox(height: 4),
                      GestureDetector(
                        onTap: () => _contactAdmin(context),
                        child: const Text(
                          '+966 50 123 4567',
                          style: TextStyle(
                            fontSize: 16,
                            color: Color(0xFF0B74FA),
                            decoration: TextDecoration.underline,
                            decorationColor: Color(0xFF0B74FA),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                backToLoginButton(context),
                const SizedBox(height: 12),
                RichText(
                  textAlign: TextAlign.center,
                  text: TextSpan(
                    style: const TextStyle(fontSize: 12, color: Color(0xFF929296)),
                    children: [
                      const TextSpan(
                        text: 'If you believe this is an error, please reach out to our technical support by ',
                      ),
                      TextSpan(
                        text: 'contacting with us',
                        style: const TextStyle(
                          color: Color(0xFF0B74FA),
                          decoration: TextDecoration.underline,
                          decorationColor: Color(0xFF0B74FA),
                        ),
                        recognizer: TapGestureRecognizer()
                          ..onTap = () => showContactDialog(context),
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
