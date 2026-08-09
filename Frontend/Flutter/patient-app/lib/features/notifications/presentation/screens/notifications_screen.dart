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

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return BlocProvider(
      create: (_) => getIt<NotificationsCubit>(),
      child: Scaffold(
        backgroundColor: const Color(0xFFF5F7FB),
        body: Column(
          children: [
            _Header(topInset: top),
            Expanded(
              child: BlocBuilder<NotificationsCubit, NotificationsState>(
                builder: (context, state) {
                  if (state.isLoading) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  if (state.errorMessage != null &&
                      state.allNotifications.isEmpty) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          state.errorMessage!,
                          textAlign: TextAlign.center,
                          style: FontHeading.body.copyWith(
                            color: AppColors.customGray,
                          ),
                        ),
                      ),
                    );
                  }

                  if (state.allNotifications.isEmpty) {
                    return FadeSlideIn(
                      child: Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              width: 88,
                              height: 88,
                              decoration: BoxDecoration(
                                color: AppColors.main_background_blue
                                    .withValues(alpha: 0.1),
                                borderRadius: const BorderRadius.only(
                                  topLeft: Radius.circular(28),
                                  topRight: Radius.circular(12),
                                  bottomLeft: Radius.circular(12),
                                  bottomRight: Radius.circular(28),
                                ),
                              ),
                              child: const Icon(
                                Icons.notifications_none_rounded,
                                size: 40,
                                color: AppColors.main_background_blue,
                              ),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'All caught up',
                              style: FontHeading.heading4,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'New updates will appear here',
                              style: FontHeading.bodySmall.copyWith(
                                color: AppColors.customGray,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }

                  return FadeSlideIn(
                    child: RefreshIndicator(
                      color: AppColors.main_background_blue,
                      onRefresh: () => context
                          .read<NotificationsCubit>()
                          .loadNotifications(),
                      child: ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(
                          parent: BouncingScrollPhysics(),
                        ),
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                        itemCount: state.allNotifications.length,
                        itemBuilder: (context, index) {
                          final item = state.allNotifications[index];
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _SwipeDeleteTile(
                              key: ValueKey(item.id),
                              item: item,
                              onTap: () => context
                                  .read<NotificationsCubit>()
                                  .markAsRead(item.id),
                              onDelete: () => context
                                  .read<NotificationsCubit>()
                                  .dismiss(item.id),
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
}

class _Header extends StatelessWidget {
  const _Header({required this.topInset});
  final double topInset;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<NotificationsCubit, NotificationsState>(
      builder: (context, state) {
        return Container(
          width: double.infinity,
          padding: EdgeInsets.fromLTRB(16, topInset + 12, 16, 22),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF0B74FA), Color(0xFF0858C7)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.only(
              bottomLeft: Radius.circular(28),
              bottomRight: Radius.circular(28),
            ),
          ),
          child: Row(
            children: [
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Notifications',
                      style: FontHeading.heading1.copyWith(
                        color: Colors.white,
                        fontSize: 22,
                      ),
                    ),
                    Text(
                      state.unreadCount > 0
                          ? '${state.unreadCount} unread'
                          : 'Swipe left to delete',
                      style: FontHeading.bodySmall.copyWith(
                        color: Colors.white70,
                      ),
                    ),
                  ],
                ),
              ),
              if (state.unreadCount > 0)
                TextButton(
                  onPressed: () =>
                      context.read<NotificationsCubit>().markAllAsRead(),
                  child: Text(
                    'Read all',
                    style: FontHeading.bodySmall.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
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

class _SwipeDeleteTile extends StatelessWidget {
  const _SwipeDeleteTile({
    super.key,
    required this.item,
    required this.onTap,
    required this.onDelete,
  });

  final NotificationItem item;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Dismissible(
      key: ValueKey('dismiss-${item.id}'),
      direction: DismissDirection.endToStart,
      onDismissed: (_) => onDelete(),
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 22),
        decoration: const BoxDecoration(
          color: Color(0xFFE11D48),
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(22),
            topRight: Radius.circular(10),
            bottomLeft: Radius.circular(10),
            bottomRight: Radius.circular(22),
          ),
        ),
        child: const Icon(Icons.delete_outline_rounded, color: Colors.white),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(22),
            topRight: Radius.circular(10),
            bottomLeft: Radius.circular(10),
            bottomRight: Radius.circular(22),
          ),
          child: Ink(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(22),
                topRight: Radius.circular(10),
                bottomLeft: Radius.circular(10),
                bottomRight: Radius.circular(22),
              ),
              border: Border.all(
                color: item.isUnread
                    ? AppColors.main_background_blue.withValues(alpha: 0.35)
                    : const Color(0xFFEEF1F6),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: AppColors.main_background_blue
                        .withValues(alpha: item.isUnread ? 0.16 : 0.08),
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(16),
                      topRight: Radius.circular(8),
                      bottomLeft: Radius.circular(8),
                      bottomRight: Radius.circular(16),
                    ),
                  ),
                  child: Icon(
                    Icons.notifications_active_rounded,
                    color: AppColors.main_background_blue
                        .withValues(alpha: item.isUnread ? 1 : 0.65),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              item.title.isEmpty ? 'MediCare' : item.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: FontHeading.body.copyWith(
                                fontWeight: item.isUnread
                                    ? FontWeight.w700
                                    : FontWeight.w600,
                              ),
                            ),
                          ),
                          Text(
                            item.time,
                            style: FontHeading.caption.copyWith(
                              color: AppColors.customGray,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        item.body,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: FontHeading.bodySmall.copyWith(
                          color: AppColors.CustomgrayDark,
                        ),
                      ),
                    ],
                  ),
                ),
                if (item.isUnread) ...[
                  const SizedBox(width: 8),
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: AppColors.main_background_blue,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
