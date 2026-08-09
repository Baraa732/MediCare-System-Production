import 'package:dartz/dartz.dart';
import '../../domain/repositories/appointment_repository.dart';
import '../data_sources/remote/appointment_remote_data_source.dart';


class AppointmentRepositoryImpl implements AppointmentRepository {
  final AppointmentRemoteDataSource remoteDataSource;

  AppointmentRepositoryImpl({required this.remoteDataSource});

  @override
  Future<Either<Exception, Unit>> callApi() async {
    try {
      return Right(await remoteDataSource.callApi());
    } on Exception catch (exception) {
      return Left(exception);
    }
  }

}

