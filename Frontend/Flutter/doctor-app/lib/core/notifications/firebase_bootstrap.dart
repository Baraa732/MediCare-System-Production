import 'package:cms_doctor_app/core/api/api_config.dart';
import 'package:cms_doctor_app/core/notifications/firebase_messaging_handler.dart';
import 'package:cms_doctor_app/core/notifications/notification_display.dart';
import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

class FirebaseBootstrap {
  FirebaseBootstrap._();

  static bool ready = false;

  static Future<bool> initialize() async {
    if (kIsWeb) return false;

    try {
      await NotificationDisplay.ensureInitialized();

      if (Firebase.apps.isEmpty) {
        var started = false;

        try {
          await Firebase.initializeApp();
          started = true;
        } catch (_) {}

        if (!started) {
          final remote = await _fetchMobileOptions();
          if (remote != null) {
            await Firebase.initializeApp(options: remote);
            started = true;
          }
        }

        if (!started) {
          if (kDebugMode) {
            debugPrint(
              'Firebase not configured for doctor app. Add google-services.json or enable remote mobile-config.',
            );
          }
          return false;
        }
      }

      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      ready = true;
      return true;
    } catch (e, stack) {
      if (kDebugMode) {
        debugPrint('Doctor Firebase bootstrap failed: $e\n$stack');
      }
      ready = false;
      return false;
    }
  }

  static Future<FirebaseOptions?> _fetchMobileOptions() async {
    try {
      final dio = Dio(
        BaseOptions(
          connectTimeout: const Duration(seconds: 8),
          receiveTimeout: const Duration(seconds: 8),
        ),
      );
      final response = await dio.get(
        '${ApiConfig.baseUrl}/notifications/push/mobile-config',
      );
      final data = response.data;
      if (data is Map && data['configured'] == true && data['config'] is Map) {
        final config = Map<String, dynamic>.from(data['config'] as Map);
        final apiKey = config['apiKey']?.toString() ?? '';
        final appId = config['appId']?.toString() ?? '';
        final projectId = config['projectId']?.toString() ?? '';
        final senderId = config['messagingSenderId']?.toString() ?? '';
        if (apiKey.isEmpty || appId.isEmpty || projectId.isEmpty) {
          return null;
        }
        return FirebaseOptions(
          apiKey: apiKey,
          appId: appId,
          messagingSenderId: senderId,
          projectId: projectId,
          storageBucket: config['storageBucket']?.toString(),
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Doctor mobile-config fetch skipped: $e');
      }
    }
    return null;
  }
}
