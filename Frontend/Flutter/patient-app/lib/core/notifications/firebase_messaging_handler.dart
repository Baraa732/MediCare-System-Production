import 'dart:convert';

import 'package:cms/core/notifications/firebase_options.dart';
import 'package:cms/core/notifications/notification_display.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _bgCacheKey = 'medicare_notification_inbox_cache';

/// Background/killed-state FCM handler — must stay a top-level function.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    if (Firebase.apps.isEmpty) {
      if (DefaultFirebaseOptions.isConfigured) {
        await Firebase.initializeApp(
          options: DefaultFirebaseOptions.currentPlatform,
        );
      } else {
        await Firebase.initializeApp();
      }
    }

    // Data-only messages need an explicit tray notification. If FCM already
    // included a notification payload, the OS shows it automatically.
    await NotificationDisplay.showFromRemoteMessage(message);

    await _cacheRemoteMessage(message);

    if (kDebugMode) {
      debugPrint(
        'Background FCM handled: ${message.messageId} '
        'hasNotification=${message.notification != null} data=${message.data}',
      );
    }
  } catch (e, stack) {
    if (kDebugMode) {
      debugPrint('Background FCM handler error: $e\n$stack');
    }
  }
}

Future<void> _cacheRemoteMessage(RemoteMessage message) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final data = message.data;
    final id = data['notificationId']?.toString() ??
        message.messageId ??
        DateTime.now().millisecondsSinceEpoch.toString();
    final title =
        message.notification?.title ?? data['title']?.toString() ?? 'MediCare';
    final body = message.notification?.body ??
        data['body']?.toString() ??
        'You have a new update';
    final category = data['category']?.toString() ?? 'SYSTEM';

    final entry = {
      'id': id,
      'title': title,
      'body': body,
      'typeText': category,
      'time': 'Just now',
      'type': 'system',
      'readAt': null,
      'createdAt': DateTime.now().toIso8601String(),
    };

    final existingRaw = prefs.getString(_bgCacheKey);
    final List<dynamic> list = existingRaw == null || existingRaw.isEmpty
        ? <dynamic>[]
        : (jsonDecode(existingRaw) as List<dynamic>);

    list.removeWhere((item) => item is Map && item['id']?.toString() == id);
    list.insert(0, entry);
    if (list.length > 80) {
      list.removeRange(80, list.length);
    }
    await prefs.setString(_bgCacheKey, jsonEncode(list));
  } catch (_) {
    // Best-effort cache for offline/killed reopen.
  }
}
