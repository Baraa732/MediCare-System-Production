import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/features/search/presentation/cubit/filter_cubit.dart';
import 'package:cms/features/search/presentation/cubit/filter_state.dart';
import 'package:cms/injection_container.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_rating/flutter_rating.dart';

class FilterScreen extends StatelessWidget {
  static const routeName = '/filter';

  const FilterScreen({super.key});

  final List<String> _specialties = const [
    'All',
    'Dentist',
    'Heart',
    'Something',
  ];

  final List<String> _sortOptions = const [
    'Popular',
    'Nearest',
    'Rating',
    'Something',
  ];

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => getIt<FilterCubit>(),
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Column(
            children: [
              // ---- App Bar ----
              _buildBlueHeader(context),
              // ---- Body (Scrollable content) ----
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 16),
                      // ---- Location ----
                      _buildLocationSection(context),
                      const SizedBox(height: 24),
                      // ---- Specialty ----
                      _buildSpecialtySection(context),
                      const SizedBox(height: 24),
                      // ---- Rating ----
                      _buildStarRate(),
                      const SizedBox(height: 24),
                      // ---- Sorted By ----
                      _buildSortSection(context),
                      const SizedBox(height: 40),
                      // Extra bottom padding to push content above buttons
                      const SizedBox(height: 20),
                    ],
                  ),
                ),
              ),
              // ---- Bottom Buttons (Sticky) ----
              _buildBottomButtons(context),
            ],
          ),
        ),
      ),
    );
  }

  // ============================================================
  //  BLUE HEADER
  // ============================================================
  Widget _buildBlueHeader(BuildContext context) {
    return RepaintBoundary(
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: AppColors.main_background_blue,
          borderRadius: const BorderRadius.only(
            bottomLeft: Radius.circular(24),
            bottomRight: Radius.circular(24),
          ),
        ),
        padding: const EdgeInsets.fromLTRB(20, 30, 20, 16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // ---- Back Button ----
            GestureDetector(
              onTap: () => Navigator.pop(context),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: AppColors.main_background_white,
                  borderRadius: BorderRadius.circular(117),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.arrow_back, color: AppColors.black, size: 16),
                    const SizedBox(width: 4),
                    Text(
                      'Back',
                      style: FontHeading.bodySmall.copyWith(
                        color: AppColors.black,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            // ---- Title ----
            Center(
              child: Text(
                'Filters',
                style: FontHeading.heading4.copyWith(color: Colors.white),
              ),
            ),
            // ---- Empty Spacer (to balance the row) ----
            const SizedBox(width: 60),
          ],
        ),
      ),
    );
  }

  // ============================================================
  //  LOCATION SECTION (Outlined Button → Navigates to Location Screen)
  // ============================================================
  Widget _buildLocationSection(BuildContext context) {
    return BlocBuilder<FilterCubit, FilterState>(
      builder: (context, state) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Location',
              style: FontHeading.heading4.copyWith(color: Colors.black),
            ),
            const SizedBox(height: 8),
            // ---- Outlined Button (Navigates to Location Screen) ----
            GestureDetector(
              onTap: () {
                // Navigate to location picker screen (to be implemented)
                // Navigator.push(
                //   context,
                //   MaterialPageRoute(
                //     builder: (context) => const LocationPickerPlaceholder(),
                //   ),
                // );
              },
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.customGray, width: 1.5),
                ),
                child: Row(
                  children: [
                    // ---- Location Icon ----
                    Icon(
                      Icons.location_on_outlined,
                      color: AppColors.CustomgrayDark,
                      size: 20,
                    ),
                    const SizedBox(width: 12),
                    // ---- Selected Location Text ----
                    Expanded(
                      child: Text(
                        state.location ?? 'Choose your Location',
                        style: FontHeading.body.copyWith(
                          color: state.location != null
                              ? AppColors.black
                              : AppColors.customGray,
                        ),
                      ),
                    ),
                    // ---- Down Arrow ----
                    Icon(
                      Icons.arrow_drop_down,
                      color: AppColors.black,
                      size: 24,
                    ),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  // ============================================================
  //  SPECIALTY SECTION
  // ============================================================
  Widget _buildSpecialtySection(BuildContext context) {
    return BlocBuilder<FilterCubit, FilterState>(
      builder: (context, state) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Specialty',
              style: FontHeading.heading4.copyWith(color: Colors.black),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _specialties.map((specialty) {
                final bool isSelected = state.specialty == specialty;
                return GestureDetector(
                  onTap: () {
                    context.read<FilterCubit>().setSpecialty(specialty);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? AppColors.main_background_blue
                          : AppColors.main_background_blue.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      specialty,
                      style: FontHeading.bodySmall.copyWith(
                        color: isSelected
                            ? Colors.white
                            : AppColors.main_background_blue,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        );
      },
    );
  }

  // ============================================================
  //  RATING SECTION
  // ============================================================
  Widget _buildStarRate() {
    return BlocBuilder<FilterCubit, FilterState>(
      builder: (context, state) {
        final double? currentRating = state.selectedRating;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Rating',
              style: FontHeading.heading4.copyWith(color: Colors.black),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // ---- Star Rating with Key ----
                StarRating(
                  key: ValueKey(
                    currentRating ?? 0,
                  ), // ✅ Forces rebuild on rating change
                  rating: currentRating ?? 0,
                  color: Colors.amberAccent,
                  borderColor: Colors.amberAccent,
                  starCount: 5,
                  size: 40,
                  onRatingChanged: (rating) {
                    final newRating = rating == 0 ? null : rating;
                    context.read<FilterCubit>().setRating(newRating);
                  },
                ),
                // ---- "Clear rating" Button ----
                TextButton(
                  onPressed: () {
                    context.read<FilterCubit>().setRating(0);
                  },
                  child: Text(
                    currentRating == 0 ? 'Any rating' : 'Clear rating',
                    style: FontHeading.bodySmall.copyWith(
                      color: AppColors.customGray,
                      decoration: TextDecoration.underline,
                      decorationColor: AppColors.customGray,
                    ),
                  ),
                ),
              ],
            ),
          ],
        );
      },
    );
  }

  // ============================================================
  //  SORTED BY SECTION
  // ============================================================
  Widget _buildSortSection(BuildContext context) {
    return BlocBuilder<FilterCubit, FilterState>(
      builder: (context, state) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Sorted by',
              style: FontHeading.heading4.copyWith(color: Colors.black),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _sortOptions.map((option) {
                final bool isSelected = state.sortBy == option;
                return GestureDetector(
                  onTap: () {
                    context.read<FilterCubit>().setSortBy(option);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? AppColors.main_background_blue
                          : AppColors.main_background_blue.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      option,
                      style: FontHeading.bodySmall.copyWith(
                        color: isSelected
                            ? Colors.white
                            : AppColors.main_background_blue,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        );
      },
    );
  }

  // ============================================================
  //  BOTTOM BUTTONS (Sticky Bottom Sheet)
  // ============================================================
  Widget _buildBottomButtons(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
      decoration: BoxDecoration(color: Colors.white),
      child: Row(
        children: [
          // ---- Reset Filters ----
          Expanded(
            child: ElevatedButton(
              onPressed: () {
                // context.read<FilterCubit>().resetFilters();
              },
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                backgroundColor: AppColors.main_background_blue.withOpacity(
                  0.1,
                ),
                shadowColor: Colors.transparent,
              ),
              child: Text(
                'Reset filters',
                style: FontHeading.button.copyWith(
                  color: AppColors.main_background_blue,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          // ---- Apply ----
          Expanded(
            child: ElevatedButton(
              onPressed: () {
                // context.read<FilterCubit>().applyFilters();
                // Navigator.pop(context);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.main_background_blue,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(
                'Apply',
                style: FontHeading.button.copyWith(color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
