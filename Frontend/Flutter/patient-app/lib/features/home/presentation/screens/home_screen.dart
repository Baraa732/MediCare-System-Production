// lib/features/home/presentation/screens/home_screen.dart
import 'package:cms/core/animations/app_page_route.dart';
import 'package:cms/core/widgets/app_avatar.dart';
import 'package:cms/core/widgets/modern_clinic_card.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/core/widgets/lazy_indexed_stack.dart';
import 'package:cms/features/booking/presentation/screens/booking_screen.dart';
import 'package:cms/features/home/presentation/cubit/home_cubit.dart';
import 'package:cms/features/home/presentation/cubit/home_state.dart';
import 'package:cms/features/home/presentation/cubit/navigation_cubit.dart';
import 'package:cms/features/home/presentation/cubit/navigation_state.dart';
import 'package:cms/features/home/presentation/widgets/animated_notification_bell.dart';
import 'package:cms/features/home/presentation/widgets/modern_home_tab.dart';
import 'package:cms/features/map/presentation/screens/map_screen.dart';
import 'package:cms/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:cms/features/profile/presentation/cubit/profile_cubit.dart';
import 'package:cms/features/profile/presentation/screens/profile_screen.dart';
import 'package:cms/features/search/presentation/screens/filter_screen.dart';
import 'package:cms/features/search/presentation/screens/search_screen.dart';
import 'package:cms/injection_container.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class HomeScreen extends StatelessWidget {
  static const routeName = '/home';

  /// Bottom-nav tab to open (0 Home, 1 Map, 2 Clinics, 3 Books, 4 Profile).
  final int initialTab;

  const HomeScreen({super.key, this.initialTab = 0});

  final List<IconData> _icons = const [
    Icons.home_outlined,
    Icons.location_on_outlined,
    Icons.local_hospital_outlined,
    Icons.calendar_month_outlined,
    Icons.person_outline,
  ];

  final List<IconData> _activeIcons = const [
    Icons.home_outlined,
    Icons.location_on_outlined,
    Icons.local_hospital,
    Icons.calendar_month_outlined,
    Icons.person_outline,
  ];

  final List<String> _labels = const [
    'Home',
    'Map',
    'Clinics',
    'Books',
    'Profile',
  ];

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (context) => getIt<HomeCubit>()..loadHomeData()),
        BlocProvider(
          create: (context) {
            final nav = NavigationCubit();
            final tab = initialTab.clamp(0, _labels.length - 1);
            if (tab != 0) nav.selectTab(tab);
            return nav;
          },
        ),
      ],
      child: Scaffold(
        backgroundColor: Colors.white,
        body: BlocBuilder<NavigationCubit, NavigationState>(
          builder: (context, navState) {
            return Column(
              children: [
                // ---- Main Content ----
                Expanded(
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 220),
                    switchInCurve: Curves.easeOutCubic,
                    switchOutCurve: Curves.easeInCubic,
                    transitionBuilder: (child, animation) {
                      return FadeTransition(opacity: animation, child: child);
                    },
                    child: KeyedSubtree(
                      key: ValueKey<int>(navState.selectedIndex),
                      child: LazyIndexedStack(
                        index: navState.selectedIndex,
                        children: [
                          const ModernHomeTab(),
                          _buildMapTap(context),
                          _buildClinicsTab(context),
                          _buildBookingTap(context),
                          _buildProfileTap(context),
                        ],
                      ),
                    ),
                  ),
                ),
                // ---- Bottom Navigation Bar ----
                _buildBottomNavBar(context, navState.selectedIndex),
              ],
            );
          },
        ),
      ),
    );
  }

  // Home tab UI lives in ModernHomeTab (BeeOrder-style header + carousel).

  // ============================================================
  //  BOTTOM NAVIGATION BAR
  // ============================================================
  Widget _buildBottomNavBar(BuildContext context, int selectedIndex) {
    return Container(
      height: 70,
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.grey.shade200,
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: List.generate(5, (index) {
          final bool isSelected = selectedIndex == index;

          return Expanded(
            child: GestureDetector(
              onTap: () {
                context.read<NavigationCubit>().selectTab(index);
              },
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // ---- Blue Thick Line ----
                  Container(
                    height: 4,
                    width: 30,
                    decoration: BoxDecoration(
                      color: isSelected
                          ? AppColors.main_background_blue
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 4),
                  // ---- Icon ----
                  Icon(
                    isSelected ? _activeIcons[index] : _icons[index],
                    color: isSelected
                        ? AppColors.main_background_blue
                        : AppColors.CustomgrayDark,
                    size: 26,
                  ),
                  const SizedBox(height: 2),
                  // ---- Label ----
                  Text(
                    _labels[index],
                    style: FontHeading.bodySmall.copyWith(
                      color: isSelected
                          ? AppColors.main_background_blue
                          : AppColors.CustomgrayDark,
                      fontSize: 10,
                      fontWeight: isSelected
                          ? FontWeight.w600
                          : FontWeight.w400,
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }

  // ============================================================
  //  BLUE HEADER (unchanged)
  // ============================================================
  Widget _buildBlueHeader(BuildContext context, HomeState state) {
    final displayName = (state.patientName?.trim().isNotEmpty ?? false)
        ? state.patientName!
        : 'Patient';
    final subtitle = (state.patientPhone?.trim().isNotEmpty ?? false)
        ? state.patientPhone!
        : 'View my records';

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
        padding: const EdgeInsets.fromLTRB(20, 30, 30, 30),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                AppAvatar(
                  imageUrl: state.patientAvatarUrl,
                  radius: 26,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        displayName,
                        style: FontHeading.heading1.copyWith(
                          fontSize: 18,
                          color: Colors.white,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        subtitle,
                        style: FontHeading.bodySmall.copyWith(
                          color: Colors.white70,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                AnimatedNotificationBell(
                  hasUnread: state.alerts.isNotEmpty,
                  onTap: () {
                    Navigator.pushNamed(
                      context,
                      NotificationsScreen.routeName,
                    );
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ============================================================
  //  SEARCH BUTTON + FILTER BUTTON
  // ============================================================
  Widget _buildSearchBar(BuildContext context) {
    return RepaintBoundary(
      child: Row(
        children: [
          // ---- Search Button (looks like a search bar) ----
          Expanded(
            child: GestureDetector(
              onTap: () {
                Navigator.push(
                  context,
                  AppPageRoute(builder: (context) => const SearchScreen()),
                );
              },
              child: Container(
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.lightGray,
                  borderRadius: BorderRadius.circular(53),
                ),
                child: Row(
                  children: [
                    const SizedBox(width: 16),
                    Icon(Icons.search, color: AppColors.black, size: 24),
                    const SizedBox(width: 8),
                    Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Text(
                        'Search clinics, doctors...',
                        style: FontHeading.bodySmall.copyWith(
                          color: AppColors.customGray,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const Spacer(),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          // ---- Filter Button ----
          Container(
            decoration: BoxDecoration(
              color: AppColors.main_background_blue,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.grey.shade200,
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: IconButton(
              onPressed: () {
                Navigator.push(
                  context,
                  AppPageRoute(builder: (context) => const FilterScreen()),
                );
              },
              icon: Icon(
                Icons.filter_list,
                color: AppColors.main_background_white,
                size: 26,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildClinicsTab(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.main_background_white,
      body: BlocBuilder<HomeCubit, HomeState>(
        builder: (context, state) {
          final clinics = state.clinics;

          return Column(
            children: [
              _buildBlueHeader(context, state),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'All clinics',
                    style: FontHeading.heading4.copyWith(color: Colors.black),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              _buildSearchBar(context),
              const SizedBox(height: 16),
              if (clinics.isEmpty)
                _buildClinicsEmptyState()
              else
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: clinics.length,
                    itemBuilder: (context, index) {
                      final clinic = clinics[index];
                      return ModernClinicCard(
                        clinic: clinic,
                        style: ModernClinicCardStyle.list,
                      );
                    },
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildClinicsEmptyState() {
    return Expanded(
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.local_hospital_outlined,
                size: 80, color: AppColors.customGray),
            const SizedBox(height: 16),
            Text(
              'No clinics yet',
              style: FontHeading.heading1.copyWith(
                color: Colors.black,
                fontSize: 24,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Clinics will appear here once they are\nregistered in the system.',
              style: FontHeading.body.copyWith(color: AppColors.customGray),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMapTap(BuildContext context) {
    return MapScreen();
  }

  Widget _buildBookingTap(BuildContext context) {
    return BookingScreen();
  }

  Widget _buildProfileTap(BuildContext context) {
    return BlocProvider(
      create: (_) => getIt<ProfileCubit>()..loadProfile(),
      child: const ProfileScreen(),
    );
  }
}
