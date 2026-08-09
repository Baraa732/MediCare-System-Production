import 'package:dartz/dartz.dart';


abstract class BookingRepository {
  Future<Either<Exception, Unit>> callApi();
}

