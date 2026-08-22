import 'package:cms/core/animations/app_lottie.dart';
import 'package:cms/core/animations/auto_scroll_lottie_pager.dart';
import 'package:cms/core/constants/assets.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/features/auth/data/data_sources/local/auth_local_data_source.dart';
import 'package:cms/features/home/presentation/screens/home_screen.dart';
import 'package:cms/core/storage/session_storage.dart';
import 'package:cms/injection_container.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Patient splash: app logo + MediCare title + auto-scrolling Lotties.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _fade;
  bool _navigating = false;

  @override
  void initState() {
    super.initState();
    _fade = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..forward();
    _goNext();
  }

  Future<void> _goNext() async {
    await Future<void>.delayed(const Duration(milliseconds: 5200));
    if (!mounted || _navigating) return;
    _navigating = true;

    final localDataSource = AuthLocalDataSource();
    // Skip the old onboarding page permanently.
    await localDataSource.setOnboardingCompleted();
    if (!mounted) return;

    final storage = getIt<SessionStorage>();
    if (storage.accessToken != null &&
        storage.accessToken!.isNotEmpty &&
        storage.role != 'PATIENT') {
      await storage.clearSession();
    }
    final loggedIn = storage.isLoggedIn;
    final nextRoute =
        loggedIn ? HomeScreen.routeName : '/welcome';

    await _fade.reverse();
    if (!mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil(nextRoute, (_) => false);
  }

  @override
  void dispose() {
    _fade.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: DecoratedBox(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFF0B74FA),
                Color(0xFF0A66DE),
                Color(0xFF0854B8),
              ],
            ),
          ),
          child: SafeArea(
            child: FadeTransition(
              opacity: _fade,
              child: Stack(
                children: [
                  // Centered brand + Lottie block
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Image.asset(
                            Assets.assetsImagesSplashLogo,
                            height: 72,
                            width: 72,
                            fit: BoxFit.contain,
                          ),
                          const SizedBox(height: 14),
                          Text(
                            'MediCare',
                            style: FontHeading.heading1.copyWith(
                              color: Colors.white,
                              fontSize: 32,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.8,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Care that moves with you',
                            style: FontHeading.body.copyWith(
                              color: Colors.white.withValues(alpha: 0.85),
                              fontSize: 14.5,
                            ),
                          ),
                          const SizedBox(height: 18),
                          const AutoScrollLottiePager(
                            assets: [
                              AppLottieAssets.patientSplash1,
                              AppLottieAssets.patientSplash2,
                            ],
                            height: 260,
                            interval: Duration(milliseconds: 2600),
                          ),
                        ],
                      ),
                    ),
                  ),
                  // Bottom status
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 28,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.2,
                            color: Colors.white.withValues(alpha: 0.9),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text(
                          'Getting things ready…',
                          style: FontHeading.bodySmall.copyWith(
                            color: Colors.white.withValues(alpha: 0.8),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
