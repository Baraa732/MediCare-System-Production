//lib/features/search/presentation/screens/search_screen.dart
import 'dart:async';

import 'package:cms/core/animations/app_lottie.dart';
import 'package:cms/core/animations/app_page_route.dart';
import 'package:cms/core/animations/fade_slide_in.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/entities/clinic.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/core/widgets/doctor_search_hero.dart';
import 'package:cms/core/widgets/modern_clinic_card.dart';
import 'package:cms/features/clinic/presentation/screens/clinic_detail_screen.dart';
import 'package:cms/features/search/presentation/cubit/search_cubit.dart';
import 'package:cms/features/search/presentation/cubit/search_state.dart';
import 'package:cms/features/search/presentation/cubit/searchresult_cubit.dart';
import 'package:cms/features/search/presentation/cubit/searchresult_state.dart';
import 'package:cms/injection_container.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class SearchScreen extends StatefulWidget {
  static const routeName = '/search';

  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final FocusNode _focusNode = FocusNode();
  final TextEditingController _controller = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      FocusScope.of(context).requestFocus(_focusNode);
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _focusNode.dispose();
    _controller.dispose();
    super.dispose();
  }

  void _onQueryChanged(String value, SearchResultsCubit resultsCubit) {
    context.read<SearchCubit>().onQueryChanged(value);
    _debounce?.cancel();

    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      resultsCubit.clearResults();
      return;
    }

    // Real-time search: short debounce, starts from first character.
    _debounce = Timer(const Duration(milliseconds: 180), () {
      resultsCubit.search(trimmed);
    });
  }

  void _openClinic(BuildContext context, Clinic clinic, String query) {
    context.read<SearchCubit>().addRecentSearch(query);
    Navigator.push(
      context,
      AppPageRoute(
        builder: (context) => ClinicDetailScreen(clinic: clinic),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (_) => getIt<SearchCubit>()),
        BlocProvider(create: (_) => getIt<SearchResultsCubit>()),
      ],
      child: Builder(
        builder: (context) {
          return Scaffold(
            backgroundColor: AppColors.main_background_white,
            body: SafeArea(
              child: Column(
                children: [
                  _buildSearchHeader(context),
                  Expanded(
                    child: BlocBuilder<SearchCubit, SearchState>(
                      builder: (context, searchState) {
                        final showLiveResults =
                            searchState.query.trim().isNotEmpty;

                        if (showLiveResults) {
                          return _buildLiveResults(context, searchState.query);
                        }

                        return FadeSlideIn(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: SingleChildScrollView(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const SizedBox(height: 20),
                                  const Center(child: DoctorSearchHero(size: 168)),
                                  const SizedBox(height: 8),
                                  Center(
                                    child: Text(
                                      'Find clinics and doctors',
                                      style: FontHeading.body.copyWith(
                                        color: AppColors.CustomgrayDark,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                  if (searchState.recentSearches.isNotEmpty) ...[
                                    const SizedBox(height: 20),
                                    Text(
                                      'Recent searches:',
                                      style: FontHeading.bodySmall.copyWith(
                                        color: AppColors.customGray,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    ..._buildSuggestionItems(
                                      context,
                                      searchState.recentSearches,
                                      icon: Icons.history,
                                    ),
                                    const SizedBox(height: 20),
                                  ],
                                  const SizedBox(height: 20),
                                  Text(
                                    'Popular searches:',
                                    style: FontHeading.heading4.copyWith(
                                      color: Colors.black,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  if (searchState.popularSearches.isEmpty)
                                    Text(
                                      'Loading suggestions...',
                                      style: FontHeading.bodySmall.copyWith(
                                        color: AppColors.customGray,
                                      ),
                                    )
                                  else
                                    ..._buildSuggestionItems(
                                      context,
                                      searchState.popularSearches,
                                      icon: Icons.search,
                                    ),
                                  const SizedBox(height: 20),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSearchHeader(BuildContext context) {
    final resultsCubit = context.read<SearchResultsCubit>();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      decoration: BoxDecoration(
        color: AppColors.main_background_blue,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(24),
          bottomRight: Radius.circular(24),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
            ),
            child: IconButton(
              padding: EdgeInsets.zero,
              splashColor: Colors.transparent,
              highlightColor: Colors.transparent,
              onPressed: () => Navigator.pop(context),
              icon: const Icon(
                Icons.arrow_back,
                color: AppColors.black,
                size: 20,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Container(
              height: 40,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
              ),
              child: TextField(
                controller: _controller,
                focusNode: _focusNode,
                autofocus: true,
                onChanged: (value) => _onQueryChanged(value, resultsCubit),
                decoration: InputDecoration(
                  hintText: 'Search clinics, doctors, specialty...',
                  hintStyle: FontHeading.body.copyWith(
                    color: AppColors.customGray,
                  ),
                  prefixIcon: const Icon(
                    Icons.search,
                    color: AppColors.customGray,
                    size: 20,
                  ),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLiveResults(BuildContext context, String query) {
    return BlocBuilder<SearchResultsCubit, SearchResultsState>(
      builder: (context, state) {
        if (state.isLoading && state.results.isEmpty) {
          return const Center(
            child: AppLottie.asset(
              asset: AppLottieAssets.loading,
              height: 120,
              fallbackIcon: Icons.hourglass_top_rounded,
            ),
          );
        }

        if (state.errorMessage != null) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                state.errorMessage!,
                style: FontHeading.body.copyWith(
                  color: Colors.orange.shade900,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          );
        }

        if (state.results.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const DoctorSearchHero(size: 150),
                  const SizedBox(height: 12),
                  Text(
                    'No clinics found for "$query"',
                    style: FontHeading.body.copyWith(color: AppColors.customGray),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: state.results.length,
          itemBuilder: (context, index) {
            final clinic = state.results[index];
            return ModernClinicCard(
              clinic: clinic,
              style: ModernClinicCardStyle.list,
              onTap: () => _openClinic(context, clinic, query),
            );
          },
        );
      },
    );
  }

  List<Widget> _buildSuggestionItems(
    BuildContext context,
    List<String> items, {
    required IconData icon,
  }) {
    final resultsCubit = context.read<SearchResultsCubit>();

    return items.map((item) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: GestureDetector(
          onTap: () {
            _controller.text = item;
            _onQueryChanged(item, resultsCubit);
          },
          child: Row(
            children: [
              Icon(icon, color: AppColors.CustomgrayDark, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  item,
                  style: FontHeading.body.copyWith(color: Colors.black),
                ),
              ),
              const Icon(
                Icons.call_made,
                size: 20,
                color: AppColors.CustomgrayDark,
              ),
            ],
          ),
        ),
      );
    }).toList();
  }
}
