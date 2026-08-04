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
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart'
    show NotificationResponse;
import 'package:shared_preferences/shared_preferences.dart';

/// Handles push for all app modes:
/// - foreground (heads-up local notification)
/// - background / swiped away
/// - fully killed (after stopping `flutter run`) via FCM + Android system tray
class PushNotificationService with WidgetsBindingObserver {
  PushNotificationService({
    required NotificationApiService notificationApi,
    required NotificationLocalStore localStore,
    required SessionStorage sessionStorage,
    required SharedPreferences prefs,
    Connectivity? connectivity,
  })  : _notificationApi = notificationApi,
        _localStore = localStore,
        _sessionStorage = sessionStorage,
        _prefs = prefs,
        _connectivity = connectivity ?? Connectivity();

  static const _tokenKey = 'medicare_fcm_token';
  static const _registeredTokenKey = 'medicare_fcm_token_registered';

  final NotificationApiService _notificationApi;
  final NotificationLocalStore _localStore;
  final SessionStorage _sessionStorage;
  final SharedPreferences _prefs;
  final Connectivity _connectivity;

  final StreamController<NotificationItem> _incomingController =
      StreamController<NotificationItem>.broadcast();

  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;

  Stream<NotificationItem> get onNotificationReceived =>
      _incomingController.stream;

  bool _initialized = false;
  String? _currentFcmToken;

  Future<void> initialize() async {
    if (_initialized) return;

    WidgetsBinding.instance.addObserver(this);
    NotificationDisplay.onTap = _onLocalNotificationTap;
    await NotificationDisplay.ensureInitialized();
    await NotificationDisplay.requestPermissions();

    _currentFcmToken = _prefs.getString(_tokenKey);

    if (FirebaseBootstrap.ready) {
      await _wireFirebaseMessaging();
    } else if (kDebugMode) {
      debugPrint(
        'Push disabled: Firebase not ready. Add google-services.json first.',
      );
    }

    _connectivitySub = _connectivity.onConnectivityChanged.listen((results) {
      if (!results.contains(ConnectivityResult.none)) {
        unawaited(ensureDeviceRegistered(reason: 'connectivity'));
      }
    });

    _initialized = true;

    if (kDebugMode) {
      debugPrint(
        'Push ready for killed-state delivery: '
        'firebase=${FirebaseBootstrap.ready} '
        'token=${_currentFcmToken != null} '
        'loggedIn=${_sessionStorage.isLoggedIn}',
      );
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(ensureDeviceRegistered(reason: 'resume'));
    }
  }

  Future<void> onUserAuthenticated() async {
    if (!_sessionStorage.isLoggedIn) return;
    await ensureDeviceRegistered(reason: 'login');
    await flushPendingReadSync();
  }

  Future<void> onUserLoggedOut() async {
    await unregisterDeviceFromBackend();
    await _prefs.remove(_registeredTokenKey);
    await _localStore.clear();
  }

  Future<bool> get isOnline async {
    final result = await _connectivity.checkConnectivity();
    return !result.contains(ConnectivityResult.none);
  }

  /// Ensures FCM token exists and is stored on the backend.
  /// Required once while the app is open; after that, closed-app push works
  /// through Google Play Services even when Flutter is not running.
  Future<void> ensureDeviceRegistered({String reason = 'manual'}) async {
    if (!FirebaseBootstrap.ready) return;

    try {
      final messaging = FirebaseMessaging.instance;
      final token = await messaging.getToken();
      if (token == null || token.isEmpty) {
        if (kDebugMode) {
          debugPrint('FCM token missing ($reason)');
        }
        return;
      }

      final tokenChanged = token != _currentFcmToken;
      _currentFcmToken = token;
      await _prefs.setString(_tokenKey, token);

      if (!_sessionStorage.isLoggedIn) {
        if (kDebugMode) {
          debugPrint('FCM token ready but user not logged in ($reason)');
        }
        return;
      }

      final alreadyRegistered = _prefs.getString(_registeredTokenKey) == token;
      if (!tokenChanged && alreadyRegistered && reason != 'login') {
        return;
      }

      await _notificationApi.registerPushDevice(
        fcmToken: token,
        platform: Platform.isIOS ? 'ios' : 'android',
        deviceLabel: '${Platform.operatingSystem} patient-app',
      );
      await _prefs.setString(_registeredTokenKey, token);

      if (kDebugMode) {
        debugPrint(
          'FCM token registered ($reason). '
          'Closed-app / killed push is now enabled for this device.',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('FCM register failed ($reason): $e');
      }
    }
  }

  Future<void> registerDeviceWithBackend() =>
      ensureDeviceRegistered(reason: 'explicit');

  Future<void> unregisterDeviceFromBackend() async {
    final token = _currentFcmToken ?? _prefs.getString(_tokenKey);
    if (token == null) return;
    try {
      await _notificationApi.unregisterPushDevice(fcmToken: token);
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

    await NotificationDisplay.requestPermissions();
    await messaging.setAutoInitEnabled(true);

    messaging.onTokenRefresh.listen((token) async {
      _currentFcmToken = token;
      await _prefs.setString(_tokenKey, token);
      await _prefs.remove(_registeredTokenKey);
      await ensureDeviceRegistered(reason: 'token-refresh');
    });

    // Foreground — draw tray ourselves.
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Background → user tapped system notification.
    FirebaseMessaging.onMessageOpenedApp.listen(_handleOpenedMessage);

    // Fully killed → user opened app from a system notification.
    final initial = await messaging.getInitialMessage();
    if (initial != null) {
      await _handleOpenedMessage(initial);
      openNotificationsFromPush();
    }

    final launch =
        await NotificationDisplay.plugin.getNotificationAppLaunchDetails();
    if (launch?.didNotificationLaunchApp == true &&
        launch?.notificationResponse != null) {
      _onLocalNotificationTap(launch!.notificationResponse!);
    }

    await ensureDeviceRegistered(reason: 'init');
  }

  Future<void> _handleForegroundMessage(RemoteMessage message) async {
    final item = _mapRemoteMessage(message);
    await _localStore.upsertNotification(item);
    if (!_incomingController.isClosed) {
      _incomingController.add(item);
    }
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
    WidgetsBinding.instance.removeObserver(this);
    await _connectivitySub?.cancel();
    await _incomingController.close();
  }
}
