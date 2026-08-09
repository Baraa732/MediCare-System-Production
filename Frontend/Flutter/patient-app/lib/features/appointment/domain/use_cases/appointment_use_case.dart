import 'package:dartz/dartz.dart';
import '../repositories/appointment_repository.dart';


class AppointmentUseCase {
  final AppointmentRepository repository;

  AppointmentUseCase(this.repository);

  Future<Either<Exception, Unit>> call() async {
    return await repository.callApi();
  }
}

