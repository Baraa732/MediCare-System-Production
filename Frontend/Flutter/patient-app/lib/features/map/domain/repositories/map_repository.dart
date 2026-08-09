import 'package:dartz/dartz.dart';


abstract class MapRepository {
  Future<Either<Exception, Unit>> callApi();
}

