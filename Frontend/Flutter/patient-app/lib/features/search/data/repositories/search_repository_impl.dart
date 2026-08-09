import 'package:dartz/dartz.dart';
import '../../domain/repositories/search_repository.dart';
import '../data_sources/remote/search_remote_data_source.dart';


class SearchRepositoryImpl implements SearchRepository {
  final SearchRemoteDataSource remoteDataSource;

  SearchRepositoryImpl({required this.remoteDataSource});

  @override
  Future<Either<Exception, Unit>> callApi() async {
    try {
      return Right(await remoteDataSource.callApi());
    } on Exception catch (exception) {
      return Left(exception);
    }
  }

}

