import 'dart:convert';
import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationDisplay {
  NotificationDisplay._();

  static const androidChannelId = 'medicare_doctor';
  static const androidChannelName = 'MediCare Doctor';
  static const androidChannelDescription =
      'Appointment updates, doctor broadcasts, and clinic notifications';

  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  static bool _ready = false;
  static void Function(NotificationResponse response)? onTap;

  static Future<void> ensureInitialized() async {
    if (_ready) return;

    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );

    await _plugin.initialize(
      const InitializationSettings(
        android: androidSettings,
        iOS: iosSettings,
      ),
      onDidReceiveNotificationResponse: (response) {
        onTap?.call(response);
      },
    );

    if (!kIsWeb && Platform.isAndroid) {
      final android = _plugin.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      await android?.createNotificationChannel(
        const AndroidNotificationChannel(
          androidChannelId,
          androidChannelName,
          description: androidChannelDescription,
          importance: Importance.max,
          playSound: true,
          enableVibration: true,
          showBadge: true,
        ),
      );
      await android?.requestNotificationsPermission();
    }

    _ready = true;
  }

  static Future<bool> requestPermissions() async {
    await ensureInitialized();
    if (kIsWeb) return false;

    if (Platform.isAndroid) {
      final android = _plugin.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      return await android?.requestNotificationsPermission() ?? true;
    }

    if (Platform.isIOS) {
      final ios = _plugin.resolvePlatformSpecificImplementation<
          IOSFlutterLocalNotificationsPlugin>();
      return await ios?.requestPermissions(
            alert: true,
            badge: true,
            sound: true,
          ) ??
          false;
    }

    return true;
  }

  static Future<void> show({
    required String id,
    required String title,
    required String body,
    Map<String, dynamic>? data,
  }) async {
    if (kIsWeb) return;
    await ensureInitialized();

    final androidDetails = AndroidNotificationDetails(
      androidChannelId,
      androidChannelName,
      channelDescription: androidChannelDescription,
      importance: Importance.max,
      priority: Priority.max,
      playSound: true,
      enableVibration: true,
      category: AndroidNotificationCategory.message,
      visibility: NotificationVisibility.public,
      ticker: title,
      styleInformation: BigTextStyleInformation(
        body,
        contentTitle: title,
        summaryText: 'MediCare Doctor',
      ),
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
      interruptionLevel: InterruptionLevel.timeSensitive,
    );

    await _plugin.show(
      id.hashCode,
      title,
      body,
      NotificationDetails(android: androidDetails, iOS: iosDetails),
      payload: jsonEncode({
        'id': id,
        'deepLink': data?['deepLink']?.toString() ?? '/notifications',
        ...?data,
      }),
    );
  }

  static Future<void> showFromRemoteMessage(
    RemoteMessage message, {
    bool force = false,
  }) async {
    if (!force && message.notification != null) {
      return;
    }

    final data = message.data;
    final title = message.notification?.title ??
        data['title']?.toString() ??
        'MediCare Doctor';
    final body = message.notification?.body ??
        data['body']?.toString() ??
        'You have a new doctor update';
    final id = data['notificationId']?.toString() ??
        message.messageId ??
        DateTime.now().millisecondsSinceEpoch.toString();

    await show(
      id: id,
      title: title,
      body: body,
      data: data,
    );
  }

  static FlutterLocalNotificationsPlugin get plugin => _plugin;
}
