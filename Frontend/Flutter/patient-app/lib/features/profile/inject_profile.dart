import '../../injection_container.dart';
import 'package:cms/core/api/services/auth_api_service.dart';
import 'package:cms/core/api/services/user_api_service.dart';
import 'package:cms/core/storage/session_storage.dart';
import 'data/data_sources/remote/profile_remote_data_source.dart';
import 'data/repositories/profile_repository_impl.dart';
import 'domain/repositories/profile_repository.dart';
import 'domain/use_cases/profile_use_case.dart';
import 'presentation/cubit/edit_profile_cubit.dart';
import 'presentation/cubit/profile_cubit.dart';

injectProfile() {
  getIt.registerFactory<ProfileCubit>(
    () => ProfileCubit(
      getIt<UserApiService>(),
      getIt<SessionStorage>(),
      getIt<AuthApiService>(),
    ),
  );

  getIt.registerFactory<EditProfileCubit>(    () => EditProfileCubit(getIt<UserApiService>(), getIt<SessionStorage>()),
  );

  getIt.registerLazySingleton<ProfileRepository>(
    () => ProfileRepositoryImpl(remoteDataSource: getIt()),
  );

  getIt.registerLazySingleton(() => ProfileUseCase(getIt()));

  getIt.registerLazySingleton<ProfileRemoteDataSource>(
    () => ProfileRemoteDataSourceImpl(getIt<UserApiService>()),
  );
}
