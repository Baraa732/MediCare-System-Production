import 'package:dartz/dartz.dart';
import '../repositories/clinic_repository.dart';


class ClinicUseCase {
  final ClinicRepository repository;

  ClinicUseCase(this.repository);

  Future<Either<Exception, Unit>> call() async {
    return await repository.callApi();
  }
}

