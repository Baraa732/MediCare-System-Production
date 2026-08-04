import 'package:cms/core/entities/notifications.dart';

class NotificationsState {
  final bool isLoading;
  final List<NotificationItem> allNotifications;
  final List<NotificationItem> filteredNotifications;
  final String selectedFilter;
  final String? errorMessage;
  final int unreadCount;
  final bool isOffline;
  final bool isFromCache;

  const NotificationsState({
    this.isLoading = false,
    this.allNotifications = const [],
    this.filteredNotifications = const [],
    this.selectedFilter = 'All',
    this.errorMessage,
    this.unreadCount = 0,
    this.isOffline = false,
    this.isFromCache = false,
  });

  NotificationsState copyWith({
    bool? isLoading,
    List<NotificationItem>? allNotifications,
    List<NotificationItem>? filteredNotifications,
    String? selectedFilter,
    String? errorMessage,
    int? unreadCount,
    bool? isOffline,
    bool? isFromCache,
  }) {
    return NotificationsState(
      isLoading: isLoading ?? this.isLoading,
      allNotifications: allNotifications ?? this.allNotifications,
      filteredNotifications:
          filteredNotifications ?? this.filteredNotifications,
      selectedFilter: selectedFilter ?? this.selectedFilter,
      errorMessage: errorMessage,
      unreadCount: unreadCount ?? this.unreadCount,
      isOffline: isOffline ?? this.isOffline,
      isFromCache: isFromCache ?? this.isFromCache,
    );
  }
}
