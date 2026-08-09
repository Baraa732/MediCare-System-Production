import 'package:cms/core/animations/app_lottie.dart';
import 'package:cms/core/constants/assets.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/features/auth/data/data_sources/local/auth_local_data_source.dart';
import 'package:cms/features/home/presentation/screens/home_screen.dart';
import 'package:cms/core/storage/session_storage.dart';
import 'package:cms/injection_container.dart';
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
    _goNext();
  }

  Future<void> _goNext() async {
    await Future<void>.delayed(const Duration(milliseconds: 2500));
    if (!mounted) return;

    final localDataSource = AuthLocalDataSource();
    final onboardingDone = await localDataSource.isOnboardingCompleted();
    if (!mounted) return;

    final loggedIn = getIt<SessionStorage>().isLoggedIn;

    final String nextRoute;
    if (!onboardingDone) {
      nextRoute = '/onboarding';
    } else if (loggedIn) {
      nextRoute = HomeScreen.routeName;
    } else {
      nextRoute = '/welcome';
    }

    Navigator.of(context).pushNamedAndRemoveUntil(nextRoute, (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.main_background_blue,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.asset(Assets.assetsImagesCross, height: 92, width: 92),
            const SizedBox(height: 20),
            Text(
              'MediCare',
              style: FontHeading.heading1.copyWith(color: Colors.white),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const AppLottie.asset(
                asset: AppLottieAssets.loading,
                height: 72,
                fallbackIcon: Icons.local_hospital_outlined,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
