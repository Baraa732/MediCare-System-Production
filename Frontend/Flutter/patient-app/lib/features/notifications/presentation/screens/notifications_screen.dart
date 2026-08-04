import 'package:cms/core/animations/fade_slide_in.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/entities/notifications.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/features/notifications/presentation/cubit/notifications_cubit.dart';
import 'package:cms/features/notifications/presentation/cubit/notifications_state.dart';
import 'package:cms/injection_container.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class NotificationsScreen extends StatelessWidget {
  static const routeName = '/notifications';

  const NotificationsScreen({super.key});

  final List<String> _filters = const [
    'All',
    'Unread',
    'Confirmed',
    'Cancelled',
    'Rescheduled',
    'Reminder',
    'Alert',
    'Update',
  ];

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => getIt<NotificationsCubit>(),
      child: Scaffold(
        backgroundColor: AppColors.lightGray,
        body: Column(
          children: [
            // ---- Custom Blue Header ----
            _buildBlueHeader(context),
            const SizedBox(height: 16),
            BlocBuilder<NotificationsCubit, NotificationsState>(
              builder: (context, state) {
                if (!state.isOffline && !state.isFromCache) {
                  return const SizedBox.shrink();
                }
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: state.isOffline
                          ? Colors.orange.shade50
                          : Colors.blue.shade50,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      state.isOffline
                          ? 'Offline — showing saved notifications. Will sync when back online.'
                          : 'Showing cached notifications. Pull to refresh when online.',
                      style: FontHeading.bodySmall.copyWith(
                        color: AppColors.CustomgrayDark,
                        fontSize: 12,
                      ),
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 8),
            // ---- Filter Chips ----
            _buildFilterChips(context),
            const SizedBox(height: 16),
            // ---- Notifications List ----
            Expanded(
              child: BlocBuilder<NotificationsCubit, NotificationsState>(
                builder: (context, state) {
                  if (state.isLoading) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  if (state.errorMessage != null &&
                      state.filteredNotifications.isEmpty) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          state.errorMessage!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.customGray),
                        ),
                      ),
                    );
                  }

                  if (state.filteredNotifications.isEmpty) {
                    return const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.notifications_off_outlined,
                            size: 64,
                            color: AppColors.customGray,
                          ),
                          SizedBox(height: 16),
                          Text(
                            'No notifications',
                            style: TextStyle(
                              color: AppColors.customGray,
                              fontSize: 16,
                            ),
                          ),
                        ],
                      ),
                    );
                  }

                  return FadeSlideIn(
                    child: RefreshIndicator(
                    onRefresh: () =>
                        context.read<NotificationsCubit>().loadNotifications(),
                    child: ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: state.filteredNotifications.length,
                      itemBuilder: (context, index) {
                        final notification = state.filteredNotifications[index];
                        return GestureDetector(
                          onTap: () {
                            context.read<NotificationsCubit>().markAsRead(
                              notification.id,
                            );
                          },
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _buildNotificationCard(notification),
                          ),
                        );
                      },
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
  }

  // ============================================================
  //  BLUE HEADER (Custom curved header)
  // ============================================================
  Widget _buildBlueHeader(BuildContext context) {
    return BlocBuilder<NotificationsCubit, NotificationsState>(
      builder: (context, state) {
        final unreadCount = state.unreadCount > 0
            ? state.unreadCount
            : state.allNotifications.where((n) => n.isUnread).length;

        return Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: AppColors.main_background_blue,
            borderRadius: const BorderRadius.only(
              bottomLeft: Radius.circular(24),
              bottomRight: Radius.circular(24),
            ),
          ),
          padding: const EdgeInsets.fromLTRB(20, 30, 20, 20),
          child: Row(
            children: [
              // ---- Back Button ----
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: const Row(
                  children: [
                    Icon(Icons.arrow_back, color: Colors.white, size: 22),
                    SizedBox(width: 4),
                    Text(
                      'Back',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              // ---- Title + Badge ----
              Row(
                children: [
                  Text(
                    'Notifications',
                    style: FontHeading.heading1.copyWith(
                      color: Colors.white,
                      fontSize: 18,
                    ),
                  ),
                  if (unreadCount > 0) ...[
                    const SizedBox(width: 8),
                    Container(
                      width: 22,
                      height: 22,
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          unreadCount.toString(),
                          style: FontHeading.bodySmall.copyWith(
                            color: AppColors.main_background_blue,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              const Spacer(),
              // ---- Mark all as read ----
              if (unreadCount > 0)
                GestureDetector(
                  onTap: () {
                    context.read<NotificationsCubit>().markAllAsRead();
                  },
                  child: Text(
                    'Mark all as read',
                    style: FontHeading.bodySmall.copyWith(
                      color: Colors.white70,
                      fontSize: 13,
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  // ============================================================
  //  FILTER CHIPS
  // ============================================================
  Widget _buildFilterChips(BuildContext context) {
    return BlocBuilder<NotificationsCubit, NotificationsState>(
      builder: (context, state) {
        return SizedBox(
          height: 40,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _filters.length,
            itemBuilder: (context, index) {
              final filter = _filters[index];
              final bool isSelected = state.selectedFilter == filter;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: GestureDetector(
                  onTap: () {
                    context.read<NotificationsCubit>().setFilter(filter);
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
                      borderRadius: BorderRadius.circular(117),
                    ),
                    child: Center(
                      child: Text(
                        filter,
                        style: FontHeading.bodySmall.copyWith(
                          color: isSelected
                              ? Colors.white
                              : AppColors.main_background_blue,
                          fontWeight: isSelected
                              ? FontWeight.w600
                              : FontWeight.w400,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }

  // ============================================================
  //  NOTIFICATION CARD (Color-coded)
  // ============================================================
  Widget _buildNotificationCard(NotificationItem notification) {
    // Color theme based on notification type
    Color iconBgColor;
    Color iconColor;
    Color metadataColor;
    Color titleColor;

    switch (notification.type) {
      case NotificationType.alert:
        iconBgColor = const Color(0xFFFFF0F0);
        iconColor = Colors.red.shade400;
        metadataColor = Colors.red.shade400;
        titleColor = const Color(0xFF550000);
        break;
      case NotificationType.success:
        iconBgColor = const Color(0xFFE8F5E9);
        iconColor = AppColors.green;
        metadataColor = AppColors.green;
        titleColor = const Color(0xFF1B5E20);
        break;
      case NotificationType.warning:
        iconBgColor = const Color(0xFFFFFDE7);
        iconColor = const Color(0xFFF57F17);
        metadataColor = const Color(0xFFF57F17);
        titleColor = const Color(0xFF4E342E);
        break;
      case NotificationType.system:
        iconBgColor = const Color(0xFFE3F2FD);
        iconColor = AppColors.main_background_blue;
        metadataColor = AppColors.main_background_blue;
        titleColor = const Color(0xFF0D47A1);
        break;
      case NotificationType.read:
        iconBgColor = Colors.grey.shade100;
        iconColor = AppColors.customGray;
        metadataColor = AppColors.customGray;
        titleColor = AppColors.CustomgrayDark;
        break;
    }

    final bool showBadge = notification.isUnread;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.shade100,
            blurRadius: 6,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ---- Category Icon Circle (with clock + "!" badge) ----
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: iconBgColor,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  // ---- Clock Icon ----
                  Icon(Icons.access_time_rounded, color: iconColor, size: 28),
                  // ---- "!" Badge (on the icon, bottom-right) ----
                  if (showBadge)
                    Positioned(
                      bottom: -1,
                      right: -2,
                      child: Container(
                        width: 14,
                        height: 14,
                        decoration: BoxDecoration(
                          color: iconBgColor,
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Text(
                            '!',
                            style: TextStyle(
                              color: iconColor,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 14),
          // ---- Text Content Column ----
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ---- Metadata Row (Type + Time) ----
                Row(
                  children: [
                    Text(
                      notification.typeText,
                      style: FontHeading.bodySmall.copyWith(
                        color: metadataColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      notification.time,
                      style: FontHeading.bodySmall.copyWith(
                        color: AppColors.customGray,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                // ---- Title ----
                Text(
                  notification.title,
                  style: FontHeading.body.copyWith(
                    color: titleColor,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                // ---- Body ----
                Text(
                  notification.body,
                  style: FontHeading.bodySmall.copyWith(
                    color: AppColors.CustomgrayDark,
                    fontSize: 13,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
