import '../../injection_container.dart';
import 'package:cms/core/api/services/clinic_api_service.dart';
import 'data/data_sources/remote/search_remote_data_source.dart';
import 'data/repositories/search_repository_impl.dart';
import 'domain/repositories/search_repository.dart';
import 'domain/use_cases/search_use_case.dart';
import 'presentation/cubit/search_cubit.dart';
import 'presentation/cubit/filter_cubit.dart';
import 'presentation/cubit/searchresult_cubit.dart';

injectSearch() {
  getIt.registerFactory(() => SearchCubit(getIt<ClinicApiService>()));
  getIt.registerFactory(() => SearchResultsCubit(getIt<ClinicApiService>()));
  getIt.registerFactory(() => FilterCubit());

  getIt.registerLazySingleton<SearchRepository>(
    () => SearchRepositoryImpl(remoteDataSource: getIt()),
  );

  getIt.registerLazySingleton(() => SearchUseCase(getIt()));

  getIt.registerLazySingleton<SearchRemoteDataSource>(
    () => SearchRemoteDataSourceImpl(getIt<ClinicApiService>()),
  );
}
