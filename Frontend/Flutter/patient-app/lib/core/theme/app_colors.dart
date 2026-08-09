import 'package:flutter/material.dart';

class AppColors {
  static const Color main_background_blue = Color(0xFF0B74FA);
  static const Color main_background_white = Colors.white;
  static const Color grayDark = Color(0xFF44454B);
  static const Color CustomgrayDark = Color(
    0xFF6F7076,
  ); // rgba(111, 112, 118, 1) – darker gray
  static const Color black = Colors.black;
  static const Color customGray = Color(0xFFB6B7B9);
  // ---- Alert Colors ----
  // Light backgrounds
  static const Color alertRedBackground = Color(0xFFFFF0F0);
  static const Color alertYellowBackground = Color(0xFFFFFDE7);

  // Big text (message)
  static const Color alertRedBigText = Color(0xFF550000); // rgba(85, 0, 0, 1)
  static const Color alertYellowBigText = Color(
    0xFF6E3100,
  ); // rgba(110, 49, 0, 1)

  // Small text (time) & arrow
  static const Color alertRedSmallText = Color(
    0xFF780000,
  ); // rgba(120, 0, 0, 1)
  static const Color alertYellowSmallText = Color(
    0xFF915300,
  ); // rgba(145, 83, 0, 1)

  // Clock icon colors (red/orange) – kept as is
  static Color alertRedIcon =
      Colors.red.shade400; // but you can define if you want
  static Color alertYellowIcon = Colors.orange.shade400;

  static const Color green = Color(0xFF4CAF50); // rgba(76, 175, 80, 1)
  static const Color yellowDark = Color(0xFFDA9C00); // rgba(218, 156, 0, 1)
  static const Color red = Colors.red;
  // ---- Orange ----
  static const Color orange = Color(0xFFF54900); // rgba(245, 73, 0, 1)
  static const Color orangeSmallText = Color(0xFFB65F38); // rgba(182, 95, 56, 1)
  static const Color orangeBigText = Color(0xFF904123);   // rgba(144, 65, 35, 1)
  static const Color lightGray = Color(0xFFF2F2F2); // rgba(242, 242, 242, 1)
}
