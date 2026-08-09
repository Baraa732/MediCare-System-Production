import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../constants/app_assets.dart';

Widget doctorAvatar({double radius = 24}) => CircleAvatar(
radius: radius,
backgroundColor: const Color(0xFFDBDBDC),
backgroundImage: const AssetImage(AppAssets.doctorPic),
);

Widget patientAvatar({double radius = 24}) => CircleAvatar(
radius: radius,
backgroundColor: const Color(0xFFDBDBDC),
backgroundImage: const AssetImage(AppAssets.patientPic),
);

Widget appLogo(String asset, {double size = 92}) => SvgPicture.asset(
asset,
width: size,
height: size,
);

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
