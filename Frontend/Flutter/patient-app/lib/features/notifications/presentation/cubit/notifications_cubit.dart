import 'dart:async';

import 'package:cms/core/entities/notifications.dart';
import 'package:cms/core/notifications/notification_sync_coordinator.dart';
import 'package:cms/core/notifications/push_notification_service.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'notifications_state.dart';

class NotificationsCubit extends Cubit<NotificationsState> {
  NotificationsCubit({
    required NotificationSyncCoordinator syncCoordinator,
    required PushNotificationService pushService,
  })  : _syncCoordinator = syncCoordinator,
        _pushService = pushService,
        super(const NotificationsState()) {
    _pushSubscription = _pushService.onNotificationReceived.listen((item) {
      _handleIncoming(item);
    });
    _syncCoordinator.startConnectivityListener(() {
      loadNotifications(showLoading: false);
    });
    loadNotifications();
  }

  final NotificationSyncCoordinator _syncCoordinator;
  final PushNotificationService _pushService;
  StreamSubscription<NotificationItem>? _pushSubscription;

  Future<void> loadNotifications({bool showLoading = true}) async {
    if (showLoading) {
      emit(state.copyWith(isLoading: true, errorMessage: null));
    }

    try {
      final result = await _syncCoordinator.loadInbox(limit: 50);
      emit(state.copyWith(
        isLoading: false,
        allNotifications: result.items,
        filteredNotifications: _applyFilter(result.items, state.selectedFilter),
        unreadCount: result.unreadCount,
        isOffline: result.isOffline,
        isFromCache: result.fromCache,
        errorMessage: result.isOffline && result.items.isEmpty
            ? 'You are offline. Notifications will sync when you reconnect.'
            : null,
      ));
    } catch (_) {
      emit(state.copyWith(
        isLoading: false,
        errorMessage: 'Could not load notifications.',
      ));
    }
  }

  Future<void> _handleIncoming(NotificationItem item) async {
    await _syncCoordinator.mergeIncoming(item);
    final updated = [item, ...state.allNotifications.where((n) => n.id != item.id)];
    emit(state.copyWith(
      allNotifications: updated,
      filteredNotifications: _applyFilter(updated, state.selectedFilter),
      unreadCount: updated.where((n) => n.isUnread).length,
    ));
  }

  void setFilter(String filter) {
    emit(state.copyWith(
      selectedFilter: filter,
      filteredNotifications: _applyFilter(state.allNotifications, filter),
    ));
  }

  Future<void> markAllAsRead() async {
    await _syncCoordinator.markAllRead();
    final updated = state.allNotifications.map((n) => n.markReadNow()).toList();
    emit(state.copyWith(
      allNotifications: updated,
      filteredNotifications: _applyFilter(updated, state.selectedFilter),
      unreadCount: 0,
    ));
  }

  Future<void> markAsRead(String id) async {
    await _syncCoordinator.markRead(id);
    final updated = state.allNotifications.map((n) {
      if (n.id == id && n.isUnread) return n.markReadNow();
      return n;
    }).toList();
    emit(state.copyWith(
      allNotifications: updated,
      filteredNotifications: _applyFilter(updated, state.selectedFilter),
      unreadCount: updated.where((n) => n.isUnread).length,
    ));
  }

  List<NotificationItem> _applyFilter(List<NotificationItem> items, String filter) {
    if (filter == 'All') return items;
    if (filter == 'Unread') return items.where((n) => n.isUnread).toList();
    return items.where((n) => n.typeText == filter).toList();
  }

  @override
  Future<void> close() async {
    await _pushSubscription?.cancel();
    await _syncCoordinator.dispose();
    return super.close();
  }
}
