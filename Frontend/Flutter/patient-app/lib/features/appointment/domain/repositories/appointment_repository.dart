import 'package:dartz/dartz.dart';


abstract class AppointmentRepository {
  Future<Either<Exception, Unit>> callApi();
}

