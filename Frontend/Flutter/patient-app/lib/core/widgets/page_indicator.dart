import 'package:cms/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class PageIndicator extends StatelessWidget {
  final int currentPage;
  final int totalPages;
  final double dotSize;
  final double selectedDotSize;

  const PageIndicator({
    super.key,
    required this.currentPage,
    required this.totalPages,
    this.dotSize = 8,
    this.selectedDotSize = 12,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(
        totalPages,
        (index) => Container(
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: currentPage == index ? selectedDotSize : dotSize,
          height: currentPage == index ? selectedDotSize : dotSize,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: currentPage == index
                ? AppColors.main_background_blue
                : AppColors.main_background_blue.withOpacity(0.4),
          ),
        ),
      ),
    );
  }
}
