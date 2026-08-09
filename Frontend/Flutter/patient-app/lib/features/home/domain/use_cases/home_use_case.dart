import 'package:dartz/dartz.dart';
import '../repositories/home_repository.dart';


class HomeUseCase {
  final HomeRepository repository;

  HomeUseCase(this.repository);

  Future<Either<Exception, Unit>> call() async {
    return await repository.callApi();
  }
}

