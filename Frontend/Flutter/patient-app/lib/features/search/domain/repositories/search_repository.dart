import 'package:dartz/dartz.dart';


abstract class SearchRepository {
  Future<Either<Exception, Unit>> callApi();
}

