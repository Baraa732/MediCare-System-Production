import 'package:dartz/dartz.dart';
import '../repositories/map_repository.dart';


class MapUseCase {
  final MapRepository repository;

  MapUseCase(this.repository);

  Future<Either<Exception, Unit>> call() async {
    return await repository.callApi();
  }
}

