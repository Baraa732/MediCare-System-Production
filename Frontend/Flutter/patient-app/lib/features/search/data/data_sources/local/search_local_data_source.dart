import 'package:dartz/dartz.dart';


abstract class SearchLocalDataSource {
  Future<Unit> getFromLocalDataBase();
}

class SearchLocalDataSourceImpl implements SearchLocalDataSource {
  SearchLocalDataSourceImpl();

  @override
  Future<Unit> getFromLocalDataBase() async {
    // send api request here
    return Future.value(unit);
  }

}
  