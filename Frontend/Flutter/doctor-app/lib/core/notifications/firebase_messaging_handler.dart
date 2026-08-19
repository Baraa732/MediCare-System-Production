import 'package:cms_doctor_app/core/notifications/notification_display.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp();
    }

    await NotificationDisplay.ensureInitialized();
    await NotificationDisplay.showFromRemoteMessage(message);

    if (kDebugMode) {
      debugPrint(
        'Doctor background FCM shown: ${message.messageId} title=${message.data['title'] ?? message.notification?.title}',
      );
    }
  } catch (e, stack) {
    if (kDebugMode) {
      debugPrint('Doctor background FCM handler error: $e\n$stack');
    }
  }
}
