import 'dart:ui';

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

class _SearchScreenState extends State<SearchScreen>
    with TickerProviderStateMixin {
  final FocusNode _focusNode = FocusNode();
  late final TextEditingController _controller;
  late final SearchCubit _searchCubit;
  late final SearchResultsCubit _resultsCubit;
  late final AnimationController _headerPulse;
  late final AnimationController _fieldGlow;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialQuery);
    _controller.addListener(() {
      if (mounted) setState(() {});
    });
    _searchCubit = getIt<SearchCubit>();
    _resultsCubit = getIt<SearchResultsCubit>();
    _headerPulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);
    _fieldGlow = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );

    _focusNode.addListener(() {
      if (_focusNode.hasFocus) {
        _fieldGlow.forward();
      } else {
        _fieldGlow.reverse();
      }
    });

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
    _focusNode.dispose();
    _controller.dispose();
    _headerPulse.dispose();
    _fieldGlow.dispose();
    _searchCubit.close();
    _resultsCubit.close();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    _searchCubit.onQueryChanged(value);

    final trimmed = value.trim();
    if (trimmed.isEmpty && !_resultsCubit.state.filters.hasActiveFilters) {
      _resultsCubit.clearResults();
      return;
    }

    // Real-time: local catalog instantly + API merge in the cubit.
    final filters = _resultsCubit.state.filters;
    _resultsCubit.search(
      trimmed,
      city: filters.city,
      governorate: filters.governorate,
      specialization: filters.specialty,
      sortBy: filters.sortBy,
      minRating: filters.minRating,
    );
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
        backgroundColor: const Color(0xFFF5F8FC),
        body: Column(
          children: [
            _buildAnimatedHeader(),
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

                  return _buildIdleDiscover(searchState);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAnimatedHeader() {
    final top = MediaQuery.paddingOf(context).top;
    return AnimatedBuilder(
      animation: Listenable.merge([_headerPulse, _fieldGlow]),
      builder: (context, _) {
        final pulse = 0.55 + (_headerPulse.value * 0.45);
        final glow = _fieldGlow.value;
        return Container(
          width: double.infinity,
          padding: EdgeInsets.fromLTRB(16, top + 12, 16, 18),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color.lerp(
                      const Color(0xFF0B74FA),
                      const Color(0xFF3B9BFF),
                      _headerPulse.value,
                    ) ??
                    const Color(0xFF0B74FA),
                const Color(0xFF0859C6),
              ],
            ),
            borderRadius: const BorderRadius.only(
              bottomLeft: Radius.circular(28),
              bottomRight: Radius.circular(28),
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0B74FA).withValues(alpha: 0.28 * pulse),
                blurRadius: 24,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _roundIconButton(
                    icon: Icons.arrow_back_rounded,
                    onTap: () => Navigator.pop(context),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Search MediCare',
                      style: FontHeading.heading4.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  _roundIconButton(
                    icon: Icons.tune_rounded,
                    onTap: _openFilters,
                    badge: _resultsCubit.state.filters.hasActiveFilters,
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Container(
                height: 52,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: Color.lerp(
                          Colors.transparent,
                          const Color(0xFF7EC0FF),
                          glow,
                        ) ??
                        Colors.transparent,
                    width: 1.6,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF0B74FA)
                          .withValues(alpha: 0.18 + glow * 0.2),
                      blurRadius: 18 + glow * 8,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: TextField(
                  controller: _controller,
                  focusNode: _focusNode,
                  autofocus: true,
                  textInputAction: TextInputAction.search,
                  onChanged: _onQueryChanged,
                  onSubmitted: _onQueryChanged,
                  style: FontHeading.body.copyWith(
                    color: const Color(0xFF102A43),
                    fontWeight: FontWeight.w600,
                  ),
                  decoration: InputDecoration(
                    hintText: 'Clinics, doctors, city, specialty…',
                    hintStyle: FontHeading.body.copyWith(
                      color: AppColors.customGray,
                    ),
                    prefixIcon: Padding(
                      padding: const EdgeInsets.only(left: 6, right: 2),
                      child: SizedBox(
                        width: 34,
                        height: 34,
                        child: AppLottie.asset(
                          asset: AppLottieAssets.searchHeartbeat,
                          height: 30,
                          fallbackIcon: Icons.search_rounded,
                        ),
                      ),
                    ),
                    prefixIconConstraints: const BoxConstraints(
                      minWidth: 42,
                      minHeight: 34,
                    ),
                    suffixIcon: _controller.text.isEmpty
                        ? null
                        : IconButton(
                            icon: const Icon(Icons.close_rounded, size: 20),
                            onPressed: () {
                              _controller.clear();
                              _onQueryChanged('');
                            },
                          ),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _roundIconButton({
    required IconData icon,
    required VoidCallback onTap,
    bool badge = false,
  }) {
    return Material(
      color: Colors.white.withValues(alpha: 0.18),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            SizedBox(
              width: 42,
              height: 42,
              child: Icon(icon, color: Colors.white, size: 22),
            ),
            if (badge)
              Positioned(
                right: 6,
                top: 6,
                child: Container(
                  width: 9,
                  height: 9,
                  decoration: const BoxDecoration(
                    color: Color(0xFFFFB020),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildIdleDiscover(SearchState searchState) {
    return FadeSlideIn(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 28),
        children: [
          const Center(
            child: DoctorSearchHero(
              size: 168,
              subtitle: 'Find clinics and doctors in real time',
            ),
          ),
          const SizedBox(height: 22),
          if (searchState.recentSearches.isNotEmpty) ...[
            Text(
              'Recent',
              style: FontHeading.heading4.copyWith(color: Colors.black),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: searchState.recentSearches
                  .map((item) => _suggestionChip(item, Icons.history_rounded))
                  .toList(),
            ),
            const SizedBox(height: 22),
          ],
          Text(
            'Popular',
            style: FontHeading.heading4.copyWith(color: Colors.black),
          ),
          const SizedBox(height: 10),
          if (searchState.popularSearches.isEmpty)
            Text(
              'Loading suggestions…',
              style: FontHeading.bodySmall.copyWith(color: AppColors.customGray),
            )
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: searchState.popularSearches
                  .map((item) => _suggestionChip(item, Icons.trending_up_rounded))
                  .toList(),
            ),
        ],
      ),
    );
  }

  Widget _suggestionChip(String item, IconData icon) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(999),
      elevation: 0,
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: () {
          _controller.text = item;
          _controller.selection =
              TextSelection.collapsed(offset: item.length);
          _onQueryChanged(item);
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: const Color(0xFFE2EAF2)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: AppColors.main_background_blue),
              const SizedBox(width: 8),
              Text(
                item,
                style: FontHeading.bodySmall.copyWith(
                  color: const Color(0xFF102A43),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLiveResults(String query) {
    return BlocBuilder<SearchResultsCubit, SearchResultsState>(
      builder: (context, state) {
        final filters = state.filters;
        return Column(
          children: [
            _liveStatusBar(state, query),
            if (filters.hasActiveFilters)
              SizedBox(
                height: 46,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  children: [
                    if (filters.city != null && filters.city!.isNotEmpty)
                      _filterChip('City: ${filters.city}'),
                    if (filters.specialty != null &&
                        filters.specialty!.isNotEmpty)
                      _filterChip(filters.specialty!),
                    if (filters.minRating != null)
                      _filterChip(
                        '${filters.minRating!.toStringAsFixed(0)}+ ★',
                      ),
                    if (filters.sortBy != 'Popular')
                      _filterChip('Sort: ${filters.sortBy}'),
                  ],
                ),
              ),
            Expanded(child: _resultsBody(state, query)),
          ],
        );
      },
    );
  }

  Widget _liveStatusBar(SearchResultsState state, String query) {
    final searching = state.isLoading;
    final count = state.results.length;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 240),
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE6EEF7)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          SizedBox(
            width: 28,
            height: 28,
            child: searching
                ? AppLottie.asset(
                    asset: AppLottieAssets.searchHeartbeat,
                    height: 28,
                    fallbackIcon: Icons.monitor_heart_outlined,
                  )
                : Icon(
                    Icons.check_circle_rounded,
                    size: 20,
                    color: AppColors.main_background_blue,
                  ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 220),
              child: Text(
                searching
                    ? 'Searching for "$query"…'
                    : '$count result${count == 1 ? '' : 's'} for "$query"',
                key: ValueKey('$searching-$count-$query'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: FontHeading.bodySmall.copyWith(
                  color: const Color(0xFF334E68),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String label) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Chip(
        label: Text(label),
        backgroundColor: AppColors.main_background_blue.withValues(alpha: 0.1),
        labelStyle: FontHeading.caption.copyWith(
          color: AppColors.main_background_blue,
          fontWeight: FontWeight.w700,
        ),
        visualDensity: VisualDensity.compact,
        side: BorderSide.none,
      ),
    );
  }

  Widget _resultsBody(SearchResultsState state, String query) {
    if (state.isLoading && state.results.isEmpty) {
      return Center(
        child: FadeSlideIn(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const DoctorSearchHero(size: 150),
              const SizedBox(height: 8),
              Text(
                'Listening for matches…',
                style: FontHeading.body.copyWith(
                  color: AppColors.CustomgrayDark,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
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
              SearchNoDataHero(
                size: 160,
                title: 'Search hiccup',
                subtitle: state.errorMessage,
              ),
              const SizedBox(height: 12),
              FilledButton(
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
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.main_background_blue,
                ),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (state.results.isEmpty) {
      return Center(
        child: FadeSlideIn(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: SearchNoDataHero(
              size: 190,
              title: 'No matches yet',
              subtitle:
                  'Nothing found for "$query". Try another clinic, doctor, or city.',
            ),
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
      itemCount: state.results.length,
      itemBuilder: (context, index) {
        final clinic = state.results[index];
        return FadeSlideIn(
          delay: Duration(milliseconds: (40 * index).clamp(0, 280)),
          offset: const Offset(0, 0.05),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 0.2, sigmaY: 0.2),
                child: ModernClinicCard(
                  clinic: clinic,
                  style: ModernClinicCardStyle.list,
                  onTap: () => _openClinic(clinic, query),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
