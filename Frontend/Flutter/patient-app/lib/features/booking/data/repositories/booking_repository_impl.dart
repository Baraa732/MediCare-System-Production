import 'package:dartz/dartz.dart';
import '../../domain/repositories/booking_repository.dart';
import '../data_sources/remote/booking_remote_data_source.dart';


class BookingRepositoryImpl implements BookingRepository {
  final BookingRemoteDataSource remoteDataSource;

  BookingRepositoryImpl({required this.remoteDataSource});

  @override
  Future<Either<Exception, Unit>> callApi() async {
    try {
      return Right(await remoteDataSource.callApi());
    } on Exception catch (exception) {
      return Left(exception);
    }
  }

}

