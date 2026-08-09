import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class HomeFilterOption {
  const HomeFilterOption({
    required this.id,
    required this.label,
    required this.icon,
  });

  final String id;
  final String label;
  final IconData icon;
}

/// Iconic horizontal filter chips (BeeOrder-style category row).
class IconicFilterRow extends StatelessWidget {
  const IconicFilterRow({
    super.key,
    required this.options,
    required this.selectedId,
    required this.onSelected,
  });

  final List<HomeFilterOption> options;
  final String selectedId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 92,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: options.length,
        separatorBuilder: (_, _) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final option = options[index];
          final selected = option.id == selectedId;
          return _FilterChip(
            option: option,
            selected: selected,
            onTap: () => onSelected(option.id),
          );
        },
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.option,
    required this.selected,
    required this.onTap,
  });

  final HomeFilterOption option;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 240),
        curve: Curves.easeOutCubic,
        width: 74,
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
        decoration: BoxDecoration(
          color: selected ? AppColors.main_background_blue : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: selected
                ? AppColors.main_background_blue
                : const Color(0xFFE8EAF0),
          ),
          boxShadow: [
            BoxShadow(
              color: selected
                  ? AppColors.main_background_blue.withValues(alpha: 0.28)
                  : Colors.black.withValues(alpha: 0.04),
              blurRadius: selected ? 14 : 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedScale(
              scale: selected ? 1.08 : 1,
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOutBack,
              child: Icon(
                option.icon,
                size: 24,
                color: selected ? Colors.white : AppColors.main_background_blue,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              option.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: FontHeading.caption.copyWith(
                color: selected ? Colors.white : AppColors.grayDark,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
