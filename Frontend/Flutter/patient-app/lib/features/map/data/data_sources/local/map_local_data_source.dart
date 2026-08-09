import 'package:dartz/dartz.dart';


abstract class MapLocalDataSource {
  Future<Unit> getFromLocalDataBase();
}

class MapLocalDataSourceImpl implements MapLocalDataSource {
  MapLocalDataSourceImpl();

  @override
  Future<Unit> getFromLocalDataBase() async {
    // send api request here
    return Future.value(unit);
  }

}
  