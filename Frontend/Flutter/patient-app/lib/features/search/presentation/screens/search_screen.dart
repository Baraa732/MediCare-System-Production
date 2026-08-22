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
import 'package:cms/features/search/presentation/screens/filter_screen.dart';
import 'package:cms/injection_container.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class SearchScreen extends StatefulWidget {
  static const routeName = '/search';

  const SearchScreen({
    super.key,
    this.initialQuery = '',
    this.initialFilters,
  });

  final String initialQuery;
  final SearchFilters? initialFilters;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final FocusNode _focusNode = FocusNode();
  late final TextEditingController _controller;
  late final SearchCubit _searchCubit;
  late final SearchResultsCubit _resultsCubit;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialQuery);
    _controller.addListener(() {
      if (mounted) setState(() {});
    });
    _searchCubit = getIt<SearchCubit>();
    _resultsCubit = getIt<SearchResultsCubit>();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      FocusScope.of(context).requestFocus(_focusNode);
      final q = widget.initialQuery.trim();
      final filters = widget.initialFilters;
      if (q.isNotEmpty || (filters?.hasActiveFilters ?? false)) {
        _searchCubit.onQueryChanged(widget.initialQuery);
        _resultsCubit.search(
          widget.initialQuery,
          city: filters?.city,
          governorate: filters?.governorate,
          specialization: filters?.specialty,
          sortBy: filters?.sortBy,
          minRating: filters?.minRating,
        );
      }
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _focusNode.dispose();
    _controller.dispose();
    _searchCubit.close();
    _resultsCubit.close();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    _searchCubit.onQueryChanged(value);
    _debounce?.cancel();

    final trimmed = value.trim();
    if (trimmed.isEmpty && !_resultsCubit.state.filters.hasActiveFilters) {
      _resultsCubit.clearResults();
      return;
    }

    _debounce = Timer(const Duration(milliseconds: 160), () {
      if (!mounted) return;
      final filters = _resultsCubit.state.filters;
      _resultsCubit.search(
        trimmed,
        city: filters.city,
        governorate: filters.governorate,
        specialization: filters.specialty,
        sortBy: filters.sortBy,
        minRating: filters.minRating,
      );
    });
  }

  Future<void> _openFilters() async {
    final applied = await Navigator.push<SearchFilters>(
      context,
      AppPageRoute(
        builder: (_) => FilterScreen(initial: _resultsCubit.state.filters),
      ),
    );
    if (!mounted || applied == null) return;
    _resultsCubit.applyFilters(applied);
    _searchCubit.onQueryChanged(_controller.text);
  }

  void _openClinic(Clinic clinic, String query) {
    _searchCubit.addRecentSearch(query);
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
        BlocProvider.value(value: _searchCubit),
        BlocProvider.value(value: _resultsCubit),
      ],
      child: Scaffold(
        backgroundColor: AppColors.main_background_white,
        body: SafeArea(
          child: Column(
            children: [
              _buildSearchHeader(),
              Expanded(
                child: BlocBuilder<SearchCubit, SearchState>(
                  builder: (context, searchState) {
                    final resultsState =
                        context.watch<SearchResultsCubit>().state;
                    final showLiveResults =
                        searchState.query.trim().isNotEmpty ||
                            resultsState.filters.hasActiveFilters;

                    if (showLiveResults) {
                      return _buildLiveResults(
                        searchState.query.trim().isEmpty
                            ? 'filtered clinics'
                            : searchState.query,
                      );
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
                                  searchState.recentSearches,
                                  icon: Icons.history,
                                ),
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
      ),
    );
  }

  Widget _buildSearchHeader() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      decoration: const BoxDecoration(
        color: AppColors.main_background_blue,
        borderRadius: BorderRadius.only(
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
              height: 44,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
              ),
              child: TextField(
                controller: _controller,
                focusNode: _focusNode,
                autofocus: true,
                textInputAction: TextInputAction.search,
                onChanged: _onQueryChanged,
                onSubmitted: _onQueryChanged,
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
                  suffixIcon: _controller.text.isEmpty
                      ? null
                      : IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          onPressed: () {
                            _controller.clear();
                            _onQueryChanged('');
                          },
                        ),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Material(
            color: Colors.white,
            shape: const CircleBorder(),
            child: IconButton(
              tooltip: 'Filters',
              onPressed: _openFilters,
              icon: const Icon(
                Icons.tune_rounded,
                color: AppColors.main_background_blue,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLiveResults(String query) {
    return BlocBuilder<SearchResultsCubit, SearchResultsState>(
      builder: (context, state) {
        final filters = state.filters;
        return Column(
          children: [
            if (filters.hasActiveFilters)
              SizedBox(
                height: 44,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                  children: [
                    if (filters.city != null && filters.city!.isNotEmpty)
                      _chip('City: ${filters.city}'),
                    if (filters.specialty != null &&
                        filters.specialty!.isNotEmpty)
                      _chip(filters.specialty!),
                    if (filters.minRating != null)
                      _chip('${filters.minRating!.toStringAsFixed(0)}+ stars'),
                    if (filters.sortBy != 'Popular')
                      _chip('Sort: ${filters.sortBy}'),
                  ],
                ),
              ),
            Expanded(child: _resultsBody(state, query)),
          ],
        );
      },
    );
  }

  Widget _chip(String label) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Chip(
        label: Text(label),
        backgroundColor: AppColors.main_background_blue.withValues(alpha: 0.1),
        labelStyle: FontHeading.caption.copyWith(
          color: AppColors.main_background_blue,
        ),
        visualDensity: VisualDensity.compact,
      ),
    );
  }

  Widget _resultsBody(SearchResultsState state, String query) {
    if (state.isLoading && state.results.isEmpty) {
      return const Center(
        child: AppLottie.asset(
          asset: AppLottieAssets.search,
          height: 140,
          fallbackIcon: Icons.search_rounded,
        ),
      );
    }

    if (state.errorMessage != null && state.results.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                state.errorMessage!,
                style: FontHeading.body.copyWith(color: Colors.orange.shade900),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () {
                  _resultsCubit.search(
                    _controller.text,
                    city: state.filters.city,
                    governorate: state.filters.governorate,
                    specialization: state.filters.specialty,
                    sortBy: state.filters.sortBy,
                    minRating: state.filters.minRating,
                  );
                },
                child: const Text('Retry'),
              ),
            ],
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
          onTap: () => _openClinic(clinic, query),
        );
      },
    );
  }

  List<Widget> _buildSuggestionItems(
    List<String> items, {
    required IconData icon,
  }) {
    return items.map((item) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: GestureDetector(
          onTap: () {
            _controller.text = item;
            _controller.selection =
                TextSelection.collapsed(offset: item.length);
            _onQueryChanged(item);
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
