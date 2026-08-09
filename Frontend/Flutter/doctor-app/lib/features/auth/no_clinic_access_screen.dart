import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/constants/app_assets.dart';
import '../../core/utils/app_dialogs.dart';
import 'auth_widgets.dart';

class NoClinicAccessScreen extends StatelessWidget {
  const NoClinicAccessScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              children: [
                const SizedBox(height: 60),
                Center(child: SvgPicture.asset(AppAssets.noClinicAccess, width: 92, height: 92)),
                const SizedBox(height: 36),
                const Text(
                  'No Clinic Access',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600, color: Color(0xFF1A1B1E)),
                ),
                const SizedBox(height: 8),
                const Text(
                  'It seems like your account is not linked to any clinic, please contact an administrator to gain access',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 18, color: Color(0xFF929296), height: 1.6),
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
