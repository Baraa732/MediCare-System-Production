import 'package:dartz/dartz.dart';
import '../repositories/search_repository.dart';


class SearchUseCase {
  final SearchRepository repository;

  SearchUseCase(this.repository);

  Future<Either<Exception, Unit>> call() async {
    return await repository.callApi();
  }
}

