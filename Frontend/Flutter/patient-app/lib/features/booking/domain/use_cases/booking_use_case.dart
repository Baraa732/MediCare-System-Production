import 'package:dartz/dartz.dart';
import '../repositories/booking_repository.dart';


class BookingUseCase {
  final BookingRepository repository;

  BookingUseCase(this.repository);

  Future<Either<Exception, Unit>> call() async {
    return await repository.callApi();
  }
}

