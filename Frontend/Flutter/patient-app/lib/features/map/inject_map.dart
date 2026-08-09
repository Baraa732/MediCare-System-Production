import '../../injection_container.dart';
import 'package:cms/core/api/services/clinic_api_service.dart';
import 'data/data_sources/remote/map_remote_data_source.dart';
import 'data/repositories/map_repository_impl.dart';
import 'domain/repositories/map_repository.dart';
import 'domain/use_cases/map_use_case.dart';
import 'presentation/cubit/map_cubit.dart';

injectMap() {
  getIt.registerFactory(() => MapCubit(mapUseCase: getIt()));

  getIt.registerLazySingleton<MapRepository>(
    () => MapRepositoryImpl(remoteDataSource: getIt()),
  );

  getIt.registerLazySingleton(() => MapUseCase(getIt()));

  getIt.registerLazySingleton<MapRemoteDataSource>(
    () => MapRemoteDataSourceImpl(getIt<ClinicApiService>()),
  );
}
