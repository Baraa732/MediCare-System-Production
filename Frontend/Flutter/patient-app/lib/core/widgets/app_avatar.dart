import 'package:cms/core/animations/app_lottie.dart';
import 'package:cms/core/utils/auth_media_headers.dart';
import 'package:cms/core/utils/media_url.dart';
import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

/// Circular avatar: network photo when present, otherwise patient profile Lottie.
class AppAvatar extends StatelessWidget {
  const AppAvatar({
    super.key,
    required this.imageUrl,
    this.radius = 26,
    this.backgroundColor = Colors.white,
  });

  final String? imageUrl;
  final double radius;
  final Color backgroundColor;

  @override
  Widget build(BuildContext context) {
    final size = radius * 2;
    final resolved = MediaUrl.resolve(imageUrl);

    Widget child;
    if (resolved.isNotEmpty) {
      child = Image.network(
        resolved,
        width: size,
        height: size,
        fit: BoxFit.cover,
        headers: AuthMediaHeaders.bearer(),
        errorBuilder: (_, __, ___) => _lottie(size),
        loadingBuilder: (context, child, progress) {
          if (progress == null) return child;
          return SizedBox(
            width: size,
            height: size,
            child: Center(
              child: SizedBox(
                width: size * 0.35,
                height: size * 0.35,
                child: const CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          );
        },
      );
    } else {
      child = _lottie(size);
    }

    return CircleAvatar(
      radius: radius,
      backgroundColor: backgroundColor,
      child: ClipOval(child: child),
    );
  }

  Widget _lottie(double size) => Lottie.asset(
        AppLottieAssets.patientProfile,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => Icon(
          Icons.person_rounded,
          size: size * 0.55,
          color: const Color(0xFF0B74FA).withValues(alpha: 0.7),
        ),
      );
}
