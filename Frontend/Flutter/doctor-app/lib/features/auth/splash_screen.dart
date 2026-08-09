import 'package:cms_doctor_app/core/constants/app_assets.dart';
import 'package:cms_doctor_app/core/widgets/common_widgets.dart';
import 'package:cms_doctor_app/features/auth/login_screen.dart';
import 'package:cms_doctor_app/features/schedule/day_view_screen.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Future<void>.delayed(const Duration(milliseconds: 1200), () {
      if (!mounted) return;
      final next = sessionStorage.isLoggedIn
          ? const DayViewScreen()
          : const LoginScreen();
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => next),
      );
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: const Color(0xFF0B74FA),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              appLogo(AppAssets.whiteLogo, size: 92),
              const SizedBox(height: 32),
              const Text(
                'MediCare Doctor',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                  letterSpacing: -0.5,
                ),
              ),
            ],
          ),
        ),
      );
}
