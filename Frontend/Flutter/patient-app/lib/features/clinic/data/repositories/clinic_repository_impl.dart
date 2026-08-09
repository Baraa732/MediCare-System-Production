import 'package:dartz/dartz.dart';
import '../../domain/repositories/clinic_repository.dart';
import '../data_sources/remote/clinic_remote_data_source.dart';


class ClinicRepositoryImpl implements ClinicRepository {
  final ClinicRemoteDataSource remoteDataSource;

  ClinicRepositoryImpl({required this.remoteDataSource});

  @override
  Future<Either<Exception, Unit>> callApi() async {
    try {
      return Right(await remoteDataSource.callApi());
    } on Exception catch (exception) {
      return Left(exception);
    }
  }

}

