import 'package:cms/core/storage/session_storage.dart';
import 'package:cms/core/api/services/notification_api_service.dart';
import 'package:cms/core/notifications/notification_local_store.dart';
import 'package:cms/core/notifications/notification_sync_coordinator.dart';
import 'package:cms/core/notifications/push_notification_service.dart';
import 'package:cms/injection_container.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'presentation/cubit/notifications_cubit.dart';

injectNotifications() {
  getIt.registerLazySingleton<NotificationLocalStore>(
    () => NotificationLocalStore(getIt()),
  );
  getIt.registerLazySingleton<PushNotificationService>(
    () => PushNotificationService(
      notificationApi: getIt<NotificationApiService>(),
      localStore: getIt<NotificationLocalStore>(),
      sessionStorage: getIt<SessionStorage>(),
      prefs: getIt<SharedPreferences>(),
    ),
  );
  getIt.registerLazySingleton<NotificationSyncCoordinator>(
    () => NotificationSyncCoordinator(
      notificationApi: getIt<NotificationApiService>(),
      localStore: getIt<NotificationLocalStore>(),
      pushService: getIt<PushNotificationService>(),
    ),
  );
  getIt.registerFactory(
    () => NotificationsCubit(
      syncCoordinator: getIt<NotificationSyncCoordinator>(),
      pushService: getIt<PushNotificationService>(),
    ),
  );
}
