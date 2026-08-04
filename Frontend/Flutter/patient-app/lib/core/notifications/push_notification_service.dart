import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:cms/core/api/entity_mappers.dart';
import 'package:cms/core/api/services/notification_api_service.dart';
import 'package:cms/core/entities/notifications.dart';
import 'package:cms/core/navigation/app_navigator.dart';
import 'package:cms/core/notifications/firebase_bootstrap.dart';
import 'package:cms/core/notifications/notification_display.dart';
import 'package:cms/core/notifications/notification_local_store.dart';
import 'package:cms/core/storage/session_storage.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart'
    show NotificationResponse;

class PushNotificationService {
  PushNotificationService({
    required NotificationApiService notificationApi,
    required NotificationLocalStore localStore,
    required SessionStorage sessionStorage,
    Connectivity? connectivity,
  })  : _notificationApi = notificationApi,
        _localStore = localStore,
        _sessionStorage = sessionStorage,
        _connectivity = connectivity ?? Connectivity();

  final NotificationApiService _notificationApi;
  final NotificationLocalStore _localStore;
  final SessionStorage _sessionStorage;
  final Connectivity _connectivity;

  final StreamController<NotificationItem> _incomingController =
      StreamController<NotificationItem>.broadcast();

  Stream<NotificationItem> get onNotificationReceived =>
      _incomingController.stream;

  bool _initialized = false;
  String? _currentFcmToken;

  Future<void> initialize() async {
    if (_initialized) return;

    NotificationDisplay.onTap = _onLocalNotificationTap;
    await NotificationDisplay.ensureInitialized();
    await NotificationDisplay.requestPermissions();

    if (FirebaseBootstrap.ready) {
      await _wireFirebaseMessaging();
    } else if (kDebugMode) {
      debugPrint(
        'Push disabled: Firebase not ready. Add google-services.json or '
        'FIREBASE_* dart-defines / mobile-config.',
      );
    }

    _initialized = true;
  }

  Future<void> onUserAuthenticated() async {
    if (!_sessionStorage.isLoggedIn) return;
    await registerDeviceWithBackend();
    await flushPendingReadSync();
  }

  Future<void> onUserLoggedOut() async {
    await unregisterDeviceFromBackend();
    await _localStore.clear();
  }

  Future<bool> get isOnline async {
    final result = await _connectivity.checkConnectivity();
    return !result.contains(ConnectivityResult.none);
  }

  Future<void> registerDeviceWithBackend() async {
    if (!_sessionStorage.isLoggedIn ||
        !FirebaseBootstrap.ready ||
        _currentFcmToken == null) {
      return;
    }

    try {
      await _notificationApi.registerPushDevice(
        fcmToken: _currentFcmToken!,
        platform: Platform.isIOS ? 'ios' : 'android',
        deviceLabel: '${Platform.operatingSystem} patient-app',
      );
      if (kDebugMode) {
        debugPrint('FCM token registered with backend');
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Push registration failed: $e');
      }
    }
  }

  Future<void> unregisterDeviceFromBackend() async {
    if (_currentFcmToken == null) return;
    try {
      await _notificationApi.unregisterPushDevice(fcmToken: _currentFcmToken!);
    } catch (_) {}
  }

  Future<void> flushPendingReadSync() async {
    if (!await isOnline || !_sessionStorage.isLoggedIn) return;

    try {
      if (_localStore.pendingReadAll) {
        await _notificationApi.markAllNotificationsRead();
        await _localStore.clearPendingReadAll();
      }

      for (final id in _localStore.pendingReadIds) {
        try {
          await _notificationApi.markNotificationRead(id);
          await _localStore.clearPendingRead(id);
        } catch (_) {}
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Pending read sync failed: $e');
      }
    }
  }

  Future<void> _wireFirebaseMessaging() async {
    final messaging = FirebaseMessaging.instance;

    await messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    final settings = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      announcement: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
    );

    if (kDebugMode) {
      debugPrint('Notification permission: ${settings.authorizationStatus}');
    }

    // Android 13+ tray permission (separate from FCM authorization).
    await NotificationDisplay.requestPermissions();

    await messaging.setAutoInitEnabled(true);

    _currentFcmToken = await messaging.getToken();
    if (kDebugMode) {
      debugPrint('FCM token: ${_currentFcmToken != null ? 'ok' : 'null'}');
    }

    messaging.onTokenRefresh.listen((token) async {
      _currentFcmToken = token;
      await registerDeviceWithBackend();
    });

    // App open / foreground — OS does not show tray; we draw it ourselves.
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // User tapped a system notification while app was backgrounded.
    FirebaseMessaging.onMessageOpenedApp.listen(_handleOpenedMessage);

    // App was killed; user opened it from a notification.
    final initial = await messaging.getInitialMessage();
    if (initial != null) {
      await _handleOpenedMessage(initial);
      openNotificationsFromPush();
    }

    final launch = await NotificationDisplay.plugin.getNotificationAppLaunchDetails();
    if (launch?.didNotificationLaunchApp == true &&
        launch?.notificationResponse != null) {
      _onLocalNotificationTap(launch!.notificationResponse!);
    }
  }

  Future<void> _handleForegroundMessage(RemoteMessage message) async {
    final item = _mapRemoteMessage(message);
    await _localStore.upsertNotification(item);
    if (!_incomingController.isClosed) {
      _incomingController.add(item);
    }
    // Force tray banner while app is open (BeeOrder-style heads-up).
    await NotificationDisplay.showFromRemoteMessage(message, force: true);
  }

  Future<void> _handleOpenedMessage(RemoteMessage message) async {
    final item = _mapRemoteMessage(message);
    await _localStore.upsertNotification(item);
    if (!_incomingController.isClosed) {
      _incomingController.add(item);
    }
    openNotificationsFromPush();
  }

  void _onLocalNotificationTap(NotificationResponse response) {
    final payload = response.payload;
    if (payload != null && payload.isNotEmpty) {
      try {
        final map = jsonDecode(payload);
        if (map is Map && map['id'] != null) {
          _incomingController.add(
            NotificationItem(
              id: map['id'].toString(),
              title: map['title']?.toString() ?? '',
              body: map['body']?.toString() ?? '',
              typeText: map['category']?.toString() ?? 'Update',
              time: 'Now',
              type: NotificationType.system,
            ),
          );
        }
      } catch (_) {}
    }
    openNotificationsFromPush();
  }

  NotificationItem _mapRemoteMessage(RemoteMessage message) {
    final data = message.data;
    final notificationId =
        data['notificationId']?.toString() ?? message.messageId ?? '';
    final category = data['category']?.toString() ?? 'SYSTEM';

    final json = {
      'id': notificationId,
      'title': message.notification?.title ?? data['title']?.toString(),
      'body': message.notification?.body ?? data['body']?.toString(),
      'type': category,
      'createdAt': DateTime.now().toIso8601String(),
    };

    return EntityMappers.notificationFromJson(json);
  }

  Future<void> dispose() async {
    await _incomingController.close();
  }
}
