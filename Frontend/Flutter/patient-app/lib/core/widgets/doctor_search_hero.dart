import 'package:cms/core/animations/app_lottie.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

/// Search idle/empty hero powered by the branded search Lottie.
class DoctorSearchHero extends StatelessWidget {
  const DoctorSearchHero({super.key, this.size = 160});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size + 24,
      height: size + 24,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: [
            AppColors.main_background_blue.withValues(alpha: 0.12),
            AppColors.main_background_blue.withValues(alpha: 0.02),
          ],
        ),
      ),
      alignment: Alignment.center,
      child: AppLottie.asset(
        asset: AppLottieAssets.search,
        height: size,
        fallbackIcon: Icons.search_rounded,
      ),
    );
  }
}
