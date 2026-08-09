import '../../injection_container.dart';
import 'package:cms/core/api/services/appointment_api_service.dart';
import 'data/data_sources/remote/booking_remote_data_source.dart';
import 'data/repositories/booking_repository_impl.dart';
import 'domain/repositories/booking_repository.dart';
import 'domain/use_cases/booking_use_case.dart';
import 'presentation/cubit/booking_cubit.dart';

injectBooking() {
  getIt.registerLazySingleton<BookingRepository>(
    () => BookingRepositoryImpl(remoteDataSource: getIt()),
  );

  getIt.registerLazySingleton(() => BookingUseCase(getIt()));

  getIt.registerLazySingleton<BookingRemoteDataSource>(
    () => BookingRemoteDataSourceImpl(getIt<AppointmentApiService>()),
  );

  getIt.registerFactory<BookingCubit>(
    () => BookingCubit(getIt<AppointmentApiService>()),
  );
}
