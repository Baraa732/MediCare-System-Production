// lib/injection_container.dart
import 'package:cms/core/api/api_client.dart';
import 'package:cms/core/api/services/appointment_api_service.dart';
import 'package:cms/core/api/services/auth_api_service.dart';
import 'package:cms/core/api/services/clinic_api_service.dart';
import 'package:cms/core/api/services/emr_api_service.dart';
import 'package:cms/core/api/services/notification_api_service.dart';
import 'package:cms/core/api/services/schedule_api_service.dart';
import 'package:cms/core/api/services/user_api_service.dart';
import 'package:cms/core/storage/saved_clinics_store.dart';
import 'package:cms/core/storage/session_storage.dart';
import 'package:cms/features/appointment/inject_appointment.dart';
import 'package:cms/features/auth/data/data_sources/local/language_data_source.dart';
import 'package:cms/features/auth/data/repositories/language_repository_imp.dart';
import 'package:cms/features/auth/domain/use_cases/change_language_use_case.dart';
import 'package:cms/features/auth/inject_auth.dart';
import 'package:cms/features/booking/inject_booking.dart';
import 'package:cms/features/clinic/inject_clinic.dart';
import 'package:cms/features/emr/inject_emr.dart';
import 'package:cms/features/home/inject_home.dart';
import 'package:cms/features/map/inject_map.dart';
import 'package:cms/features/notifications/inject_notifications.dart';
import 'package:cms/features/profile/inject_profile.dart';
import 'package:cms/features/search/inject_search.dart';
import 'package:get_it/get_it.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:cms/features/auth/domain/repositories/language_repository.dart';
import 'package:cms/features/auth/domain/use_cases/get_saved_language_use_case.dart';
import 'package:cms/features/auth/presentation/cubit/language_cubit.dart';

final getIt = GetIt.instance;

Future<void> init() async {
  final sharedPreferences = await SharedPreferences.getInstance();
  getIt.registerSingleton<SharedPreferences>(sharedPreferences);

  // Session + HTTP client
  getIt.registerLazySingleton<SessionStorage>(
    () => SessionStorage(getIt<SharedPreferences>()),
  );
  getIt.registerLazySingleton<SavedClinicsStore>(
    () => SavedClinicsStore(getIt<SharedPreferences>()),
  );
  getIt.registerLazySingleton<ApiClient>(
    () => ApiClient(getIt<SessionStorage>()),
  );

  // MediCare API services
  getIt.registerLazySingleton<AuthApiService>(
    () => AuthApiService(getIt<ApiClient>(), getIt<SessionStorage>()),
  );
  getIt.registerLazySingleton<ClinicApiService>(
    () => ClinicApiService(getIt<ApiClient>()),
  );
  getIt.registerLazySingleton<AppointmentApiService>(
    () => AppointmentApiService(getIt<ApiClient>()),
  );
  getIt.registerLazySingleton<ScheduleApiService>(
    () => ScheduleApiService(getIt<ApiClient>()),
  );
  getIt.registerLazySingleton<UserApiService>(
    () => UserApiService(getIt<ApiClient>()),
  );
  getIt.registerLazySingleton<NotificationApiService>(
    () => NotificationApiService(getIt<ApiClient>()),
  );
  getIt.registerLazySingleton<EmrApiService>(
    () => EmrApiService(getIt<ApiClient>()),
  );

  // Language
  getIt.registerLazySingleton<LanguageLocalDataSource>(
    () => LanguageLocalDataSource(sharedPreferences: getIt()),
  );
  getIt.registerLazySingleton<LanguageRepository>(
    () => LanguageRepositoryImpl(localDataSource: getIt()),
  );
  getIt.registerLazySingleton(
    () => GetSavedLanguageUseCase(repository: getIt()),
  );
  getIt.registerLazySingleton(() => SaveLanguageUseCase(repository: getIt()));
  getIt.registerFactory(
    () => LanguageCubit(
      getSavedLanguageUseCase: getIt(),
      saveLanguageUseCase: getIt(),
    ),
  );

  initAuthInjection();
  injectHome();
  injectAppointment();
  injectClinic();
  injectMap();
  injectSearch();
  injectBooking();
  injectProfile();
  injectNotifications();
  injectEmr();
}
