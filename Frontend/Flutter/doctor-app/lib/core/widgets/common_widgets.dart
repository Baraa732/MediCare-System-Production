import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:lottie/lottie.dart';

import '../constants/app_assets.dart';
import '../utils/media_url.dart';

Widget doctorAvatar({double radius = 24, String? imageUrl}) {
  final size = radius * 2;
  final url = MediaUrl.resolve(imageUrl);
  Widget fallback() => Image.asset(
        AppAssets.doctorPic,
        width: size,
        height: size,
        fit: BoxFit.cover,
      );
  return CircleAvatar(
    radius: radius,
    backgroundColor: const Color(0xFFDBDBDC),
    child: ClipOval(
      child: url.isNotEmpty
          ? Image.network(
              url,
              width: size,
              height: size,
              fit: BoxFit.cover,
              gaplessPlayback: true,
              errorBuilder: (_, __, ___) => fallback(),
              loadingBuilder: (context, child, progress) {
                if (progress == null) return child;
                return fallback();
              },
            )
          : fallback(),
    ),
  );
}

Widget patientAvatar({double radius = 24, String? imageUrl}) {
  final size = radius * 2;
  final url = MediaUrl.resolve(imageUrl);
  return CircleAvatar(
    radius: radius,
    backgroundColor: const Color(0xFFDBDBDC),
    child: ClipOval(
      child: url.isNotEmpty
          ? Image.network(
              url,
              width: size,
              height: size,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Lottie.asset(
                AppAssets.lottiePatientProfile,
                width: size,
                height: size,
                fit: BoxFit.cover,
              ),
            )
          : Lottie.asset(
              AppAssets.lottiePatientProfile,
              width: size,
              height: size,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Image.asset(
                AppAssets.patientPic,
                width: size,
                height: size,
                fit: BoxFit.cover,
              ),
            ),
    ),
  );
}

Widget appLogo(String asset, {double size = 92}) {
  if (asset.toLowerCase().endsWith('.svg')) {
    return SvgPicture.asset(asset, width: size, height: size);
  }
  return Image.asset(
    asset,
    width: size,
    height: size,
    fit: BoxFit.contain,
  );
}

Widget svgIcon(String asset, {double size = 24, Color? color}) => SvgPicture.asset(
      asset,
      width: size,
      height: size,
      colorFilter: color != null ? ColorFilter.mode(color, BlendMode.srcIn) : null,
    );

Widget tabNavIcon(String asset, {required bool selected}) => svgIcon(
      asset,
      size: 24,
      color: selected ? const Color(0xFF0B74FA) : const Color(0xFF929296),
    );

Widget noteLabel(String text, {TextStyle? style}) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SvgPicture.asset(AppAssets.staffNotesClinicalNote, width: 12, height: 12),
        const SizedBox(width: 4),
        Text(text, style: style ?? const TextStyle(fontSize: 12, color: Color(0xFF929296))),
      ],
    );

OutlineInputBorder inputBorder(Color color, {double width = 1}) =>
    OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: BorderSide(color: color, width: width),
    );
