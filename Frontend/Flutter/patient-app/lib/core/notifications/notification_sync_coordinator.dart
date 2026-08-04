import 'dart:async';

import 'package:cms/core/api/api_exception.dart';
import 'package:cms/core/api/services/notification_api_service.dart';
import 'package:cms/core/entities/notifications.dart';
import 'package:cms/core/notifications/notification_local_store.dart';
import 'package:cms/core/notifications/push_notification_service.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

class NotificationSyncResult {
  const NotificationSyncResult({
    required this.items,
    required this.unreadCount,
    this.fromCache = false,
    this.isOffline = false,
  });

  final List<NotificationItem> items;
  final int unreadCount;
  final bool fromCache;
  final bool isOffline;
}

class NotificationSyncCoordinator {
  NotificationSyncCoordinator({
    required NotificationApiService notificationApi,
    required NotificationLocalStore localStore,
    required PushNotificationService pushService,
    Connectivity? connectivity,
  })  : _notificationApi = notificationApi,
        _localStore = localStore,
        _pushService = pushService,
        _connectivity = connectivity ?? Connectivity();

  final NotificationApiService _notificationApi;
  final NotificationLocalStore _localStore;
  final PushNotificationService _pushService;
  final Connectivity _connectivity;

  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;

  void startConnectivityListener(void Function() onReconnect) {
    _connectivitySub?.cancel();
    _connectivitySub = _connectivity.onConnectivityChanged.listen((results) {
      if (!results.contains(ConnectivityResult.none)) {
        onReconnect();
      }
    });
  }

  Future<void> dispose() async {
    await _connectivitySub?.cancel();
  }

  Future<NotificationSyncResult> loadInbox({int limit = 30}) async {
    final cached = _localStore.loadInbox();
    final online = await _pushService.isOnline;

    if (!online) {
      return NotificationSyncResult(
        items: cached,
        unreadCount: cached.where((n) => n.isUnread).length,
        fromCache: cached.isNotEmpty,
        isOffline: true,
      );
    }

    try {
      await _pushService.flushPendingReadSync();
      final inbox = await _notificationApi.fetchInbox(limit: limit);
      await _localStore.saveInbox(inbox.items);
      return NotificationSyncResult(
        items: inbox.items,
        unreadCount: inbox.unreadCount,
        fromCache: false,
        isOffline: false,
      );
    } on ApiException {
      return NotificationSyncResult(
        items: cached,
        unreadCount: cached.where((n) => n.isUnread).length,
        fromCache: true,
        isOffline: false,
      );
    }
  }

  Future<void> markRead(String id) async {
    final current = _localStore.loadInbox();
    final updated = current.map((n) {
      if (n.id == id && n.isUnread) return n.markReadNow();
      return n;
    }).toList();
    await _localStore.saveInbox(updated);

    final online = await _pushService.isOnline;
    if (online) {
      try {
        await _notificationApi.markNotificationRead(id);
      } catch (_) {
        await _localStore.queueMarkRead(id);
      }
    } else {
      await _localStore.queueMarkRead(id);
    }
  }

  Future<void> markAllRead() async {
    final current = _localStore.loadInbox();
    final updated = current.map((n) => n.markReadNow()).toList();
    await _localStore.saveInbox(updated);

    final online = await _pushService.isOnline;
    if (online) {
      try {
        await _notificationApi.markAllNotificationsRead();
      } catch (_) {
        await _localStore.queueMarkAllRead();
      }
    } else {
      await _localStore.queueMarkAllRead();
    }
  }

  Future<void> mergeIncoming(NotificationItem item) async {
    await _localStore.upsertNotification(item);
  }
}
