import 'package:flutter/material.dart';

import '../../core/constants/app_assets.dart';
import '../../core/widgets/common_widgets.dart';
import '../../core/widgets/language_selector.dart';
import 'auth_widgets.dart';

class GoodToGoScreen extends StatelessWidget {
const GoodToGoScreen({super.key});
@override
Widget build(BuildContext context) => Scaffold(
backgroundColor: Colors.white,
body: SafeArea(
child: Padding(
padding: const EdgeInsets.symmetric(horizontal: 24),
child: Column(
children: [
Align(
alignment: Alignment.centerRight,
child: Padding(
padding: const EdgeInsets.only(top: 16),
child: const LanguageSelector(),
),
),
const SizedBox(height: 40),
appLogo(AppAssets.blueLogo, size: 92),
const SizedBox(height: 36),
const Text(
"You're good to go",
textAlign: TextAlign.center,
style: TextStyle(
fontSize: 24,
fontWeight: FontWeight.w600,
color: Color(0xFF1A1B1E),
letterSpacing: -0.5,
),
),
const SizedBox(height: 8),
const Text(
'Your password have been reset, you can go back to Login page',
textAlign: TextAlign.center,
style: TextStyle(fontSize: 18, color: Color(0xFF929296), height: 1.6),
),
const Spacer(),
backToLoginButton(context),
const SizedBox(height: 24),
],
),
),
),
);
}
