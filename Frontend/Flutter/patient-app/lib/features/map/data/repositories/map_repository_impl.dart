import 'package:dartz/dartz.dart';
import '../../domain/repositories/map_repository.dart';
import '../data_sources/remote/map_remote_data_source.dart';


class MapRepositoryImpl implements MapRepository {
  final MapRemoteDataSource remoteDataSource;

  MapRepositoryImpl({required this.remoteDataSource});

  @override
  Future<Either<Exception, Unit>> callApi() async {
    try {
      return Right(await remoteDataSource.callApi());
    } on Exception catch (exception) {
      return Left(exception);
    }
  }

}

