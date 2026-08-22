import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

/// Thin Lottie wrapper with a Material icon fallback if the asset fails.
class AppLottie extends StatelessWidget {
  const AppLottie.asset({
    super.key,
    required this.asset,
    this.height = 160,
    this.width,
    this.repeat = true,
    this.fallbackIcon = Icons.search_rounded,
  });

  final String asset;
  final double height;
  final double? width;
  final bool repeat;
  final IconData fallbackIcon;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      width: width ?? height,
      child: Lottie.asset(
        asset,
        fit: BoxFit.contain,
        repeat: repeat,
        errorBuilder: (context, error, stackTrace) => Icon(
          fallbackIcon,
          size: height * 0.45,
          color: const Color(0xFF0B74FA).withValues(alpha: 0.55),
        ),
      ),
    );
  }
}

/// Bundled Lottie asset paths.
abstract final class AppLottieAssets {
  static const search = 'assets/lottie/search.json';
  static const empty = 'assets/lottie/empty.json';
  static const success = 'assets/lottie/success.json';
  static const loading = 'assets/lottie/loading.json';
  static const patientSplash1 = 'assets/lottie/patient_splash_1.json';
  static const patientSplash2 = 'assets/lottie/patient_splash_2.json';
  static const pendingApproval = 'assets/lottie/pending_approval.json';
  static const rescheduleAppointment =
      'assets/lottie/reschedule_appointment.json';
  static const patientProfile = 'assets/lottie/patient_profile.json';
}
