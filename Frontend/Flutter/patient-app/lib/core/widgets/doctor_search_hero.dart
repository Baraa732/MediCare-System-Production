import 'package:cms/core/animations/app_lottie.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

/// Search idle/searching hero powered by the heartbeat Lottie.
class DoctorSearchHero extends StatelessWidget {
  const DoctorSearchHero({
    super.key,
    this.size = 160,
    this.subtitle,
  });

  final double size;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: size + 28,
          height: size + 28,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [
                AppColors.main_background_blue.withValues(alpha: 0.16),
                AppColors.main_background_blue.withValues(alpha: 0.02),
              ],
            ),
          ),
          alignment: Alignment.center,
          child: AppLottie.asset(
            asset: AppLottieAssets.searchHeartbeat,
            height: size,
            fallbackIcon: Icons.monitor_heart_outlined,
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 8),
          Text(
            subtitle!,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.CustomgrayDark,
              fontWeight: FontWeight.w600,
              fontSize: 14,
            ),
          ),
        ],
      ],
    );
  }
}

/// Empty search results hero powered by the No-Data Lottie.
class SearchNoDataHero extends StatelessWidget {
  const SearchNoDataHero({
    super.key,
    this.size = 180,
    this.title = 'Nothing found',
    this.subtitle,
  });

  final double size;
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AppLottie.asset(
          asset: AppLottieAssets.searchNoData,
          height: size,
          fallbackIcon: Icons.search_off_rounded,
        ),
        const SizedBox(height: 8),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Color(0xFF1A1A1A),
            fontWeight: FontWeight.w700,
            fontSize: 17,
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 6),
          Text(
            subtitle!,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.customGray,
              fontSize: 13,
              height: 1.35,
            ),
          ),
        ],
      ],
    );
  }
}
