import '../../injection_container.dart';
import 'package:cms/core/api/services/clinic_api_service.dart';
import 'data/data_sources/remote/clinic_remote_data_source.dart';
import 'data/repositories/clinic_repository_impl.dart';
import 'domain/repositories/clinic_repository.dart';
import 'domain/use_cases/clinic_use_case.dart';
import 'presentation/cubit/clinic_cubit.dart';
import 'presentation/cubit/clinic_detail_cubit.dart';
import 'package:cms/core/utils/geocode_service.dart';

injectClinic() {
  getIt.registerLazySingleton(() => GeocodeService());
  getIt.registerFactory(
    () => ClinicDetailCubit(getIt<ClinicApiService>(), getIt<GeocodeService>()),
  );
  getIt.registerFactory(() => ClinicCubit(clinicUseCase: getIt()));

  getIt.registerLazySingleton<ClinicRepository>(
    () => ClinicRepositoryImpl(remoteDataSource: getIt()),
  );

  getIt.registerLazySingleton(() => ClinicUseCase(getIt()));

  getIt.registerLazySingleton<ClinicRemoteDataSource>(
    () => ClinicRemoteDataSourceImpl(getIt<ClinicApiService>()),
  );
}
