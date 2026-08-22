import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/features/search/presentation/cubit/filter_cubit.dart';
import 'package:cms/features/search/presentation/cubit/filter_state.dart';
import 'package:cms/features/search/presentation/cubit/searchresult_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_rating/flutter_rating.dart';

class FilterScreen extends StatefulWidget {
  static const routeName = '/filter';

  const FilterScreen({super.key, this.initial});

  final SearchFilters? initial;

  @override
  State<FilterScreen> createState() => _FilterScreenState();
}

class _FilterScreenState extends State<FilterScreen> {
  static const _specialties = <String>[
    'All',
    'General Medicine',
    'Dentist',
    'Cardiology',
    'Dermatology',
    'Pediatrics',
    'Orthopedics',
    'Ophthalmology',
    'ENT',
    'Gynecology',
    'Neurology',
    'Psychiatry',
  ];

  static const _sortOptions = <String>['Popular', 'Nearest', 'Rating'];

  static const _cities = <String>[
    'Damascus',
    'Aleppo',
    'Homs',
    'Latakia',
    'Hama',
    'Tartus',
    'Idlib',
    'Daraa',
    'Sweida',
    'Quneitra',
    'Raqqa',
    'Deir ez-Zor',
    'Hasakah',
  ];

  late final TextEditingController _locationCtrl;
  late final FilterCubit _cubit;

  @override
  void initState() {
    super.initState();
    final seed = widget.initial;
    _locationCtrl = TextEditingController(
      text: seed?.city ?? seed?.governorate ?? '',
    );
    _cubit = FilterCubit(
      initial: FilterState(
        location: seed?.city ?? seed?.governorate,
        specialty: seed?.specialty ?? 'All',
        selectedRating: seed?.minRating,
        sortBy: seed?.sortBy ?? 'Popular',
      ),
    );
  }

  @override
  void dispose() {
    _locationCtrl.dispose();
    _cubit.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _cubit,
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Column(
            children: [
              _buildBlueHeader(context),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 16),
                      _buildLocationSection(),
                      const SizedBox(height: 24),
                      _buildSpecialtySection(),
                      const SizedBox(height: 24),
                      _buildStarRate(),
                      const SizedBox(height: 24),
                      _buildSortSection(),
                      const SizedBox(height: 40),
                    ],
                  ),
                ),
              ),
              _buildBottomButtons(context),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBlueHeader(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: AppColors.main_background_blue,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(24),
          bottomRight: Radius.circular(24),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(20, 30, 20, 16),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.main_background_white,
                borderRadius: BorderRadius.circular(117),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.arrow_back, color: AppColors.black, size: 16),
                  const SizedBox(width: 4),
                  Text(
                    'Back',
                    style: FontHeading.bodySmall.copyWith(color: AppColors.black),
                  ),
                ],
              ),
            ),
          ),
          const Spacer(),
          Text(
            'Filters',
            style: FontHeading.heading4.copyWith(color: Colors.white),
          ),
          const Spacer(),
          const SizedBox(width: 64),
        ],
      ),
    );
  }

  Widget _buildLocationSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'City / location',
          style: FontHeading.heading4.copyWith(color: Colors.black),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _locationCtrl,
          onChanged: _cubit.setLocation,
          decoration: InputDecoration(
            hintText: 'e.g. Damascus',
            filled: true,
            fillColor: AppColors.lightGray,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            prefixIcon: const Icon(Icons.location_on_outlined),
          ),
        ),
        const SizedBox(height: 10),
        BlocBuilder<FilterCubit, FilterState>(
          builder: (context, state) {
            return Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _cities.map((city) {
                final selected =
                    (state.location ?? '').toLowerCase() == city.toLowerCase();
                return ChoiceChip(
                  label: Text(city),
                  selected: selected,
                  onSelected: (_) {
                    _locationCtrl.text = city;
                    _cubit.setLocation(city);
                  },
                  selectedColor: AppColors.main_background_blue,
                  labelStyle: TextStyle(
                    color: selected
                        ? Colors.white
                        : AppColors.main_background_blue,
                  ),
                );
              }).toList(),
            );
          },
        ),
      ],
    );
  }

  Widget _buildSpecialtySection() {
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
              children: _specialties.map((option) {
                final selected = state.specialty == option;
                return GestureDetector(
                  onTap: () => _cubit.setSpecialty(option),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: selected
                          ? AppColors.main_background_blue
                          : AppColors.main_background_blue
                              .withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      option,
                      style: FontHeading.bodySmall.copyWith(
                        color: selected
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

  Widget _buildStarRate() {
    return BlocBuilder<FilterCubit, FilterState>(
      builder: (context, state) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Minimum rating',
              style: FontHeading.heading4.copyWith(color: Colors.black),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                StarRating(
                  rating: state.selectedRating ?? 0,
                  size: 28,
                  color: AppColors.main_background_blue,
                  borderColor: AppColors.main_background_blue,
                  allowHalfRating: false,
                  onRatingChanged: (rating) => _cubit.setRating(rating),
                ),
                const Spacer(),
                TextButton(
                  onPressed: () => _cubit.setRating(null),
                  child: Text(
                    'Clear',
                    style: FontHeading.bodySmall.copyWith(
                      color: AppColors.customGray,
                      decoration: TextDecoration.underline,
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

  Widget _buildSortSection() {
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
                final selected = state.sortBy == option;
                return GestureDetector(
                  onTap: () => _cubit.setSortBy(option),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: selected
                          ? AppColors.main_background_blue
                          : AppColors.main_background_blue
                              .withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      option,
                      style: FontHeading.bodySmall.copyWith(
                        color: selected
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

  Widget _buildBottomButtons(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
      color: Colors.white,
      child: Row(
        children: [
          Expanded(
            child: ElevatedButton(
              onPressed: () {
                _locationCtrl.clear();
                _cubit.resetFilters();
              },
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                backgroundColor:
                    AppColors.main_background_blue.withValues(alpha: 0.1),
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
          Expanded(
            child: ElevatedButton(
              onPressed: () {
                final applied = _cubit.applyFilters();
                final location = applied.location?.trim();
                Navigator.pop(
                  context,
                  SearchFilters(
                    city: location,
                    specialty: applied.specialty,
                    sortBy: applied.sortBy ?? 'Popular',
                    minRating: applied.selectedRating,
                  ),
                );
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
