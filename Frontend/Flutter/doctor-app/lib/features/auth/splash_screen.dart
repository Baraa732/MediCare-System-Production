import 'dart:async';

import 'package:cms_doctor_app/core/constants/app_assets.dart';
import 'package:cms_doctor_app/features/auth/login_screen.dart';
import 'package:cms_doctor_app/features/schedule/day_view_screen.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lottie/lottie.dart';

/// Doctor splash: app logo + title + auto Lottie carousel (blue-matched frames).
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  static const _assets = [
    AppAssets.lottieDoctorDancing,
    AppAssets.lottieDoctorPushups,
  ];

  late final PageController _pageController;
  late final AnimationController _fade;
  Timer? _autoScroll;
  int _index = 0;
  bool _navigating = false;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(viewportFraction: 0.88);
    _fade = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    )..forward();
    _autoScroll = Timer.periodic(const Duration(milliseconds: 2700), (_) {
      if (!mounted || !_pageController.hasClients) return;
      final next = (_index + 1) % _assets.length;
      _pageController.animateToPage(
        next,
        duration: const Duration(milliseconds: 540),
        curve: Curves.easeInOutCubic,
      );
    });
    _boot();
  }

  Future<void> _boot() async {
    await Future<void>.delayed(const Duration(milliseconds: 5400));
    if (!mounted || _navigating) return;
    _navigating = true;

    if (sessionStorage.isLoggedIn) {
      try {
        await authApi.refreshProfileNames();
        await pushNotificationService.onUserAuthenticated();
      } catch (_) {}
    }
    if (!mounted) return;

    await _fade.reverse();
    if (!mounted) return;

    final next = sessionStorage.isLoggedIn
        ? const DayViewScreen()
        : const LoginScreen();
    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        pageBuilder: (_, __, ___) => next,
        transitionsBuilder: (_, anim, __, child) =>
            FadeTransition(opacity: anim, child: child),
        transitionDuration: const Duration(milliseconds: 380),
      ),
    );
  }

  @override
  void dispose() {
    _autoScroll?.cancel();
    _pageController.dispose();
    _fade.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.sizeOf(context).height;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: ColoredBox(
          color: const Color(0xFF0B74FA),
          child: SafeArea(
            child: FadeTransition(
              opacity: _fade,
              child: Column(
                children: [
                  const SizedBox(height: 24),
                  Image.asset(
                    AppAssets.splashLogo,
                    height: 72,
                    width: 72,
                    fit: BoxFit.contain,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'MediCare Doctor',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.7,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Your day, already in motion',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.86),
                      fontSize: 14.5,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    height: height * 0.40,
                    child: PageView.builder(
                      controller: _pageController,
                      itemCount: _assets.length,
                      onPageChanged: (i) => setState(() => _index = i),
                      itemBuilder: (context, i) {
                        final active = i == _index;
                        return AnimatedScale(
                          scale: active ? 1 : 0.9,
                          duration: const Duration(milliseconds: 320),
                          child: AnimatedOpacity(
                            opacity: active ? 1 : 0.55,
                            duration: const Duration(milliseconds: 320),
                            child: Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 8),
                              child: Lottie.asset(
                                _assets[i],
                                fit: BoxFit.contain,
                                repeat: true,
                                errorBuilder: (_, __, ___) => Icon(
                                  Icons.medical_services_rounded,
                                  size: 88,
                                  color: Colors.white.withValues(alpha: 0.8),
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(_assets.length, (i) {
                      final active = i == _index;
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 280),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        height: 8,
                        width: active ? 22 : 8,
                        decoration: BoxDecoration(
                          color:
                              Colors.white.withValues(alpha: active ? 1 : 0.35),
                          borderRadius: BorderRadius.circular(99),
                        ),
                      );
                    }),
                  ),
                  const Spacer(),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 28),
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
                          'Preparing your schedule…',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.82),
                            fontSize: 13.5,
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
