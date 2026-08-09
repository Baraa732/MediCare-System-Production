import 'package:dartz/dartz.dart';


abstract class ClinicRepository {
  Future<Either<Exception, Unit>> callApi();
}

