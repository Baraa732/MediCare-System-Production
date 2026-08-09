import 'package:dartz/dartz.dart';


abstract class BookingLocalDataSource {
  Future<Unit> getFromLocalDataBase();
}

class BookingLocalDataSourceImpl implements BookingLocalDataSource {
  BookingLocalDataSourceImpl();

  @override
  Future<Unit> getFromLocalDataBase() async {
    // send api request here
    return Future.value(unit);
  }

}
  