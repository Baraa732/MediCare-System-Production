import '../../injection_container.dart';
import 'package:cms/core/api/services/appointment_api_service.dart';
import 'data/data_sources/remote/appointment_remote_data_source.dart';
import 'data/repositories/appointment_repository_impl.dart';
import 'domain/repositories/appointment_repository.dart';
import 'domain/use_cases/appointment_use_case.dart';
import 'presentation/cubit/appointment_cubit.dart';

injectAppointment() {
  getIt.registerFactory(() => AppointmentCubit(appointmentUseCase: getIt()));

  getIt.registerLazySingleton<AppointmentRepository>(
    () => AppointmentRepositoryImpl(remoteDataSource: getIt()),
  );

  getIt.registerLazySingleton(() => AppointmentUseCase(getIt()));

  getIt.registerLazySingleton<AppointmentRemoteDataSource>(
    () => AppointmentRemoteDataSourceImpl(getIt<AppointmentApiService>()),
  );
}
