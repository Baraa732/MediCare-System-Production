import 'package:dartz/dartz.dart';
import '../../domain/repositories/home_repository.dart';
import '../data_sources/remote/home_remote_data_source.dart';


class HomeRepositoryImpl implements HomeRepository {
  final HomeRemoteDataSource remoteDataSource;

  HomeRepositoryImpl({required this.remoteDataSource});

  @override
  Future<Either<Exception, Unit>> callApi() async {
    try {
      return Right(await remoteDataSource.callApi());
    } on Exception catch (exception) {
      return Left(exception);
    }
  }

}

