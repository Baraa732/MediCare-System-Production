import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:cms_doctor_app/core/api/services/notification_api_service.dart';
import 'package:cms_doctor_app/core/navigation/app_navigation.dart';
import 'package:cms_doctor_app/core/notifications/firebase_bootstrap.dart';
import 'package:cms_doctor_app/core/notifications/notification_display.dart';
import 'package:cms_doctor_app/core/storage/session_storage.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart'
    show NotificationResponse;
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

class PushNotificationService with WidgetsBindingObserver {
  PushNotificationService({
    required NotificationApiService notificationApi,
    required SessionStorage sessionStorage,
    required SharedPreferences prefs,
    Connectivity? connectivity,
  })  : _notificationApi = notificationApi,
        _sessionStorage = sessionStorage,
        _prefs = prefs,
        _connectivity = connectivity ?? Connectivity();

  static const _tokenKey = 'doctor_fcm_token';
  static const _registeredTokenKey = 'doctor_fcm_token_registered';
  static const _batteryPromptKey = 'doctor_battery_opt_prompted';

  final NotificationApiService _notificationApi;
  final SessionStorage _sessionStorage;
  final SharedPreferences _prefs;
  final Connectivity _connectivity;

  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
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
    }

    _connectivitySub = _connectivity.onConnectivityChanged.listen((results) {
      if (!results.contains(ConnectivityResult.none)) {
        unawaited(ensureDeviceRegistered(reason: 'connectivity'));
      }
    });

    _initialized = true;
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
  }

  Future<void> onUserLoggedOut() async {
    await unregisterDeviceFromBackend();
    await _prefs.remove(_registeredTokenKey);
  }

  Future<bool> get isOnline async {
    final result = await _connectivity.checkConnectivity();
    return !result.contains(ConnectivityResult.none);
  }

  Future<void> ensureDeviceRegistered({String reason = 'manual'}) async {
    if (!FirebaseBootstrap.ready) return;

    try {
      final messaging = FirebaseMessaging.instance;
      final token = await messaging.getToken();
      if (token == null || token.isEmpty) return;

      final tokenChanged = token != _currentFcmToken;
      _currentFcmToken = token;
      await _prefs.setString(_tokenKey, token);

      if (!_sessionStorage.isLoggedIn) return;

      final alreadyRegistered = _prefs.getString(_registeredTokenKey) == token;
      if (!tokenChanged && alreadyRegistered && reason != 'login') {
        return;
      }

      await _notificationApi.registerPushDevice(
        fcmToken: token,
        platform: Platform.isIOS ? 'ios' : 'android',
        deviceLabel: '${Platform.operatingSystem} doctor-app',
      );
      await _prefs.setString(_registeredTokenKey, token);
      await _requestUnrestrictedBatteryIfNeeded();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Doctor FCM register failed ($reason): $e');
      }
    }
  }

  Future<void> unregisterDeviceFromBackend() async {
    final token = _currentFcmToken ?? _prefs.getString(_tokenKey);
    if (token == null) return;
    try {
      await _notificationApi.unregisterPushDevice(fcmToken: token);
    } catch (_) {}
  }

  Future<void> _requestUnrestrictedBatteryIfNeeded() async {
    if (!Platform.isAndroid) return;
    if (_prefs.getBool(_batteryPromptKey) == true) return;

    try {
      final status = await Permission.ignoreBatteryOptimizations.status;
      if (status.isGranted) {
        await _prefs.setBool(_batteryPromptKey, true);
        return;
      }
      await Permission.ignoreBatteryOptimizations.request();
      await _prefs.setBool(_batteryPromptKey, true);
    } catch (_) {}
  }

  Future<void> _wireFirebaseMessaging() async {
    final messaging = FirebaseMessaging.instance;

    await messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      announcement: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
    );

    await NotificationDisplay.requestPermissions();
    await messaging.setAutoInitEnabled(true);

    messaging.onTokenRefresh.listen((token) async {
      _currentFcmToken = token;
      await _prefs.setString(_tokenKey, token);
      await _prefs.remove(_registeredTokenKey);
      await ensureDeviceRegistered(reason: 'token-refresh');
    });

    FirebaseMessaging.onMessage.listen((message) async {
      await NotificationDisplay.showFromRemoteMessage(message, force: true);
    });

    FirebaseMessaging.onMessageOpenedApp.listen((_) {
      openNotificationsFromPush();
    });

    final initial = await messaging.getInitialMessage();
    if (initial != null) {
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

  void _onLocalNotificationTap(NotificationResponse response) {
    final payload = response.payload;
    if (payload != null && payload.isNotEmpty) {
      try {
        jsonDecode(payload);
      } catch (_) {}
    }
    openNotificationsFromPush();
  }

  Future<void> dispose() async {
    WidgetsBinding.instance.removeObserver(this);
    await _connectivitySub?.cancel();
  }
}
