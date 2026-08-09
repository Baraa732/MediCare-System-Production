import 'package:cms/features/home/presentation/cubit/navigation_cubit.dart';

import '../../injection_container.dart';
import 'data/data_sources/remote/home_remote_data_source.dart';
import 'data/repositories/home_repository_impl.dart';
import 'domain/repositories/home_repository.dart';
import 'domain/use_cases/home_use_case.dart';
import 'presentation/cubit/home_cubit.dart';
import 'package:cms/core/api/services/appointment_api_service.dart';
import 'package:cms/core/api/services/clinic_api_service.dart';
import 'package:cms/core/api/services/notification_api_service.dart';
import 'package:cms/core/api/services/user_api_service.dart';
import 'package:cms/core/storage/session_storage.dart';

injectHome() {
  getIt.registerFactory(
    () => HomeCubit(
      clinicApi: getIt<ClinicApiService>(),
      appointmentApi: getIt<AppointmentApiService>(),
      notificationApi: getIt<NotificationApiService>(),
      userApi: getIt<UserApiService>(),
      sessionStorage: getIt<SessionStorage>(),
    ),
  );

  getIt.registerFactory(() => NavigationCubit());

  getIt.registerLazySingleton<HomeRepository>(
    () => HomeRepositoryImpl(remoteDataSource: getIt()),
  );

  getIt.registerLazySingleton(() => HomeUseCase(getIt()));

  getIt.registerLazySingleton<HomeRemoteDataSource>(
    () => HomeRemoteDataSourceImpl(getIt<ClinicApiService>()),
  );
}
