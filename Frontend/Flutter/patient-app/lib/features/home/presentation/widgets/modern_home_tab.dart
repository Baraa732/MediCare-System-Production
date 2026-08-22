import 'package:cms/core/animations/app_page_route.dart';
import 'package:cms/core/animations/fade_slide_in.dart';
import 'package:cms/core/constants/assets.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/entities/appointment.dart';
import 'package:cms/core/entities/clinic.dart';
import 'package:cms/core/entities/history.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/core/widgets/app_avatar.dart';
import 'package:cms/core/widgets/app_network_image.dart';
import 'package:cms/features/appointment/presentation/screens/appointment_detail_screen.dart';
import 'package:cms/features/home/presentation/cubit/home_cubit.dart';
import 'package:cms/features/home/presentation/cubit/home_state.dart';
import 'package:cms/features/home/presentation/cubit/navigation_cubit.dart';
import 'package:cms/features/home/presentation/widgets/animated_notification_bell.dart';
import 'package:cms/features/home/presentation/widgets/clinic_peek_carousel.dart';
import 'package:cms/features/home/presentation/widgets/iconic_filter_row.dart';
import 'package:cms/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:cms/features/search/presentation/screens/filter_screen.dart';
import 'package:cms/features/search/presentation/screens/search_screen.dart';
import 'package:cms/features/search/presentation/cubit/searchresult_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// Modern BeeOrder-inspired home feed.
class ModernHomeTab extends StatefulWidget {
  const ModernHomeTab({super.key});

  @override
  State<ModernHomeTab> createState() => _ModernHomeTabState();
}

class _ModernHomeTabState extends State<ModernHomeTab> {
  static const _allId = 'all';
  static const _nearbyId = 'nearby';
  static const _topRatedId = 'top_rated';
  static const _openNowId = 'open_now';

  String _selectedFilter = _allId;

  List<HomeFilterOption> _buildFilters(List<Clinic> clinics) {
    return const [
      HomeFilterOption(
        id: _allId,
        label: 'All',
        icon: Icons.apps_rounded,
      ),
      HomeFilterOption(
        id: _nearbyId,
        label: 'Nearby',
        icon: Icons.near_me_rounded,
      ),
      HomeFilterOption(
        id: _topRatedId,
        label: 'Top rated',
        icon: Icons.star_rounded,
      ),
      HomeFilterOption(
        id: _openNowId,
        label: 'Open now',
        icon: Icons.schedule_rounded,
      ),
    ];
  }

  List<Clinic> _applyFilter(List<Clinic> clinics) {
    final list = List<Clinic>.from(clinics);
    switch (_selectedFilter) {
      case _nearbyId:
        list.sort((a, b) {
          final aHas = a.hasCoordinates ? 0 : 1;
          final bHas = b.hasCoordinates ? 0 : 1;
          if (aHas != bHas) return aHas - bHas;
          return a.name.compareTo(b.name);
        });
        return list;
      case _topRatedId:
        list.sort((a, b) => b.rating.compareTo(a.rating));
        return list;
      case _openNowId:
        return list
            .where((c) {
              final h = c.hours.toLowerCase();
              return h.contains('open') ||
                  h.contains('24') ||
                  h.contains('am') ||
                  h.contains('pm') ||
                  h.isNotEmpty;
            })
            .toList();
      default:
        return list;
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<HomeCubit, HomeState>(
      builder: (context, state) {
        if (state.isLoading) {
          return const Center(child: CircularProgressIndicator());
        }

        final filters = _buildFilters(state.clinics);
        final filteredClinics = _applyFilter(state.clinics);
        final topInset = MediaQuery.paddingOf(context).top;

        return RefreshIndicator(
          color: AppColors.main_background_blue,
          onRefresh: () => context.read<HomeCubit>().loadHomeData(),
          child: CustomScrollView(
            physics: const BouncingScrollPhysics(
              parent: AlwaysScrollableScrollPhysics(),
            ),
            slivers: [
              SliverToBoxAdapter(
                child: FadeSlideIn(
                  child: _BeeOrderHeader(
                    topInset: topInset,
                    state: state,
                    onSearchTap: () {
                      Navigator.push(
                        context,
                        AppPageRoute(
                          builder: (_) => const SearchScreen(),
                        ),
                      );
                    },
                    onFilterTap: () async {
                      final applied = await Navigator.push<SearchFilters>(
                        context,
                        AppPageRoute(
                          builder: (_) => const FilterScreen(),
                        ),
                      );
                      if (!context.mounted || applied == null) return;
                      Navigator.push(
                        context,
                        AppPageRoute(
                          builder: (_) => SearchScreen(initialFilters: applied),
                        ),
                      );
                    },
                    onNotificationsTap: () {
                      Navigator.pushNamed(
                        context,
                        NotificationsScreen.routeName,
                      );
                    },
                  ),
                ),
              ),
              if (state.errorMessage != null)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 36, 16, 0),
                    child: _ErrorBanner(message: state.errorMessage!),
                  ),
                ),
              // Space for overlapping search bar
              const SliverToBoxAdapter(child: SizedBox(height: 36)),
              SliverToBoxAdapter(
                child: FadeSlideIn(
                  delay: const Duration(milliseconds: 80),
                  child: IconicFilterRow(
                    options: filters,
                    selectedId: _selectedFilter,
                    onSelected: (id) => setState(() => _selectedFilter = id),
                  ),
                ),
              ),
              const SpacedSliver(height: 8),
              if (state.appointments.isNotEmpty) ...[
                SliverToBoxAdapter(
                  child: FadeSlideIn(
                    delay: const Duration(milliseconds: 120),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: _SectionHeader(
                        title: 'Upcoming appointments',
                        onSeeAll: () {
                          context.read<NavigationCubit>().selectTab(3);
                        },
                      ),
                    ),
                  ),
                ),
                const SpacedSliver(height: 12),
                SliverToBoxAdapter(
                  child: FadeSlideIn(
                    delay: const Duration(milliseconds: 160),
                    child: _AppointmentsStrip(appointments: state.appointments),
                  ),
                ),
                const SpacedSliver(height: 22),
              ],
              SliverToBoxAdapter(
                child: FadeSlideIn(
                  delay: const Duration(milliseconds: 180),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: _SectionHeader(
                      title: 'Clinics near you',
                      icon: Icons.local_hospital_outlined,
                      onSeeAll: () {
                        context.read<NavigationCubit>().selectTab(2);
                      },
                    ),
                  ),
                ),
              ),
              const SpacedSliver(height: 12),
              SliverToBoxAdapter(
                child: FadeSlideIn(
                  delay: const Duration(milliseconds: 220),
                  child: filteredClinics.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: _EmptyBox(
                            title: 'No clinics match',
                            subtitle: 'Try another filter or search',
                          ),
                        )
                      : ClinicPeekCarousel(clinics: filteredClinics),
                ),
              ),
              const SpacedSliver(height: 22),
              SliverToBoxAdapter(
                child: FadeSlideIn(
                  delay: const Duration(milliseconds: 260),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: _SectionHeader(
                      title: 'Visit history',
                      onSeeAll: () {
                        context.read<NavigationCubit>().selectTab(3);
                      },
                    ),
                  ),
                ),
              ),
              const SpacedSliver(height: 12),
              SliverToBoxAdapter(
                child: FadeSlideIn(
                  delay: const Duration(milliseconds: 300),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 28),
                    child: Column(
                      children: state.history.isEmpty
                          ? [
                              _EmptyBox(
                                image: Assets.assetsImagesEmptybox,
                                title: "You don't have a visit history",
                                subtitle:
                                    "You'll find clinics you visited recently here",
                              ),
                            ]
                          : state.history
                              .map((item) => _HistoryTile(item: item))
                              .toList(),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class SpacedSliver extends StatelessWidget {
  const SpacedSliver({super.key, required this.height});
  final double height;

  @override
  Widget build(BuildContext context) =>
      SliverToBoxAdapter(child: SizedBox(height: height));
}

class _BeeOrderHeader extends StatelessWidget {
  const _BeeOrderHeader({
    required this.topInset,
    required this.state,
    required this.onSearchTap,
    required this.onFilterTap,
    required this.onNotificationsTap,
  });

  final double topInset;
  final HomeState state;
  final VoidCallback onSearchTap;
  final VoidCallback onFilterTap;
  final VoidCallback onNotificationsTap;

  @override
  Widget build(BuildContext context) {
    final displayName = (state.patientName?.trim().isNotEmpty ?? false)
        ? state.patientName!
        : 'Patient';
    final subtitle = (state.patientPhone?.trim().isNotEmpty ?? false)
        ? state.patientPhone!
        : 'Find care near you';

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: double.infinity,
          padding: EdgeInsets.fromLTRB(20, topInset + 14, 20, 56),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFF0B74FA),
                Color(0xFF0858C7),
                Color(0xFF0A6AE0),
              ],
            ),
            borderRadius: BorderRadius.only(
              bottomLeft: Radius.circular(28),
              bottomRight: Radius.circular(28),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.55),
                        width: 2,
                      ),
                    ),
                    child: AppAvatar(
                      imageUrl: state.patientAvatarUrl,
                      radius: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Hello,',
                          style: FontHeading.bodySmall.copyWith(
                            color: Colors.white70,
                            fontSize: 13,
                          ),
                        ),
                        Text(
                          displayName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: FontHeading.heading1.copyWith(
                            fontSize: 20,
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: FontHeading.bodySmall.copyWith(
                            color: Colors.white60,
                          ),
                        ),
                      ],
                    ),
                  ),
                  AnimatedNotificationBell(
                    hasUnread: state.alerts.isNotEmpty,
                    onTap: onNotificationsTap,
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Text(
                'Book your next visit',
                style: FontHeading.body.copyWith(
                  color: Colors.white.withValues(alpha: 0.92),
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
            ],
          ),
        ),
        Positioned(
          left: 16,
          right: 16,
          bottom: -26,
          child: Material(
            elevation: 0,
            color: Colors.transparent,
            child: Container(
              height: 54,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.12),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      textInputAction: TextInputAction.search,
                      onTap: onSearchTap,
                      onSubmitted: (value) {
                        final q = value.trim();
                        Navigator.push(
                          context,
                          AppPageRoute(
                            builder: (_) => SearchScreen(initialQuery: q),
                          ),
                        );
                      },
                      decoration: InputDecoration(
                        hintText: 'Search clinics, doctors...',
                        hintStyle: FontHeading.bodySmall.copyWith(
                          color: AppColors.customGray,
                          fontSize: 14,
                        ),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 0,
                          vertical: 14,
                        ),
                        prefixIcon: Icon(
                          Icons.search_rounded,
                          color: AppColors.main_background_blue,
                          size: 24,
                        ),
                        prefixIconConstraints: const BoxConstraints(
                          minWidth: 48,
                          minHeight: 24,
                        ),
                      ),
                      style: FontHeading.bodySmall.copyWith(
                        color: AppColors.black,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: Material(
                      color: AppColors.main_background_blue,
                      borderRadius: BorderRadius.circular(22),
                      child: InkWell(
                        onTap: onFilterTap,
                        borderRadius: BorderRadius.circular(22),
                        child: const SizedBox(
                          width: 42,
                          height: 42,
                          child: Icon(
                            Icons.tune_rounded,
                            color: Colors.white,
                            size: 22,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    required this.onSeeAll,
    this.icon,
  });

  final String title;
  final VoidCallback onSeeAll;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (icon != null) ...[
          Icon(icon, size: 20, color: AppColors.main_background_blue),
          const SizedBox(width: 8),
        ],
        Expanded(
          child: Text(
            title,
            style: FontHeading.heading4.copyWith(color: Colors.black),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        GestureDetector(
          onTap: onSeeAll,
          child: Text(
            'See all',
            style: FontHeading.bodySmall.copyWith(
              color: AppColors.main_background_blue,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

class _AppointmentsStrip extends StatelessWidget {
  const _AppointmentsStrip({required this.appointments});
  final List<Appointment> appointments;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 118,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        physics: const BouncingScrollPhysics(),
        itemCount: appointments.length,
        itemBuilder: (context, index) {
          final appointment = appointments[index];
          return Padding(
            padding: EdgeInsets.only(
              right: index == appointments.length - 1 ? 0 : 12,
            ),
            child: GestureDetector(
              onTap: () {
                Navigator.push(
                  context,
                  AppPageRoute(
                    builder: (_) =>
                        AppointmentDetailScreen(appointment: appointment),
                  ),
                );
              },
              child: Container(
                width: 300,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF0B74FA), Color(0xFF0A5FD1)],
                  ),
                  borderRadius: BorderRadius.circular(18),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.main_background_blue
                          .withValues(alpha: 0.28),
                      blurRadius: 14,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: Colors.white,
                      child: ClipOval(
                        child: AppNetworkImage.doctor(
                          imageUrl: appointment.doctorImageUrl,
                          width: 56,
                          height: 56,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            appointment.doctorName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: FontHeading.heading4.copyWith(
                              color: Colors.white,
                            ),
                          ),
                          Text(
                            appointment.followUp ?? appointment.clinicName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: FontHeading.bodySmall.copyWith(
                              color: Colors.white70,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              const Icon(
                                Icons.calendar_today_outlined,
                                size: 14,
                                color: Colors.white70,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                appointment.date,
                                style: FontHeading.caption.copyWith(
                                  color: Colors.white,
                                ),
                              ),
                              const SizedBox(width: 12),
                              const Icon(
                                Icons.access_time_outlined,
                                size: 14,
                                color: Colors.white70,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                appointment.time,
                                style: FontHeading.caption.copyWith(
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.item});
  final History item;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEEF0F5)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: const AppNetworkImage.clinic(
              imageUrl: '',
              width: 64,
              height: 64,
              fit: BoxFit.cover,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.clinicName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: FontHeading.body.copyWith(
                    color: Colors.black,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(
                      Icons.location_on_outlined,
                      size: 14,
                      color: AppColors.CustomgrayDark,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        item.location,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: FontHeading.bodySmall.copyWith(
                          color: AppColors.CustomgrayDark,
                        ),
                      ),
                    ),
                  ],
                ),
                Text(
                  item.timeVisited,
                  style: FontHeading.caption.copyWith(
                    color: AppColors.customGray,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyBox extends StatelessWidget {
  const _EmptyBox({
    required this.title,
    required this.subtitle,
    this.image,
  });

  final String title;
  final String subtitle;
  final String? image;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFEEF0F5)),
      ),
      child: Column(
        children: [
          if (image != null)
            SizedBox(
              width: 100,
              height: 100,
              child: Image.asset(image!, fit: BoxFit.contain),
            )
          else
            const Icon(
              Icons.inbox_outlined,
              size: 42,
              color: AppColors.customGray,
            ),
          const SizedBox(height: 10),
          Text(
            title,
            textAlign: TextAlign.center,
            style: FontHeading.body.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: FontHeading.bodySmall.copyWith(color: AppColors.customGray),
          ),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.orange.shade200),
      ),
      child: Text(
        message,
        style: FontHeading.bodySmall.copyWith(color: Colors.orange.shade900),
      ),
    );
  }
}
