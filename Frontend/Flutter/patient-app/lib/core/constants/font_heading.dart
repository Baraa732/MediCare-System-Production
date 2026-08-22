import 'package:cms/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

/// Typography tokens for the patient app.
///
/// Defaults target light surfaces (white / gray cards). Use
/// [FontHeading.onPrimary] or `.copyWith(color: Colors.white)` on blue
/// headers and primary buttons.
class FontHeading {
  static const Color ink = Color(0xFF1A1B1E);
  static const Color inkSecondary = Color(0xFF6F7076);

  static const TextStyle heading1 = TextStyle(
    fontSize: 28,
    fontWeight: FontWeight.w700,
    fontFamily: 'Inter',
    color: ink,
  );
  static const TextStyle heading2 = TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w600,
    fontFamily: 'Inter',
    color: ink,
  );
  static const TextStyle heading3 = TextStyle(
    fontSize: 20,
    fontWeight: FontWeight.w600,
    fontFamily: 'Inter',
    color: ink,
  );
  static const TextStyle heading4 = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w500,
    fontFamily: 'Inter',
    color: ink,
  );
  static const TextStyle bodyLarge = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w400,
    fontFamily: 'Inter',
    color: ink,
  );
  static const TextStyle body = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w400,
    fontFamily: 'Inter',
    color: ink,
  );
  static const TextStyle bodySmall = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    fontFamily: 'Inter',
    color: inkSecondary,
  );
  static const TextStyle caption = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    fontFamily: 'Inter',
    color: inkSecondary,
  );

  /// White label for filled primary buttons and blue surfaces.
  static const TextStyle button = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    fontFamily: 'Inter',
    color: AppColors.main_background_white,
  );

  /// Dark label for tonal / text buttons on light backgrounds.
  static const TextStyle buttonDark = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    fontFamily: 'Inter',
    color: ink,
  );

  /// White headings for gradient headers.
  static TextStyle onPrimary(TextStyle base) =>
      base.copyWith(color: AppColors.main_background_white);
}
