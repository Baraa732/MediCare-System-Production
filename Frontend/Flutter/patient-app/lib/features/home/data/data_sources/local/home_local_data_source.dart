import 'package:dartz/dartz.dart';


abstract class HomeLocalDataSource {
  Future<Unit> getFromLocalDataBase();
}

class HomeLocalDataSourceImpl implements HomeLocalDataSource {
  HomeLocalDataSourceImpl();

  @override
  Future<Unit> getFromLocalDataBase() async {
    // send api request here
    return Future.value(unit);
  }

}
  