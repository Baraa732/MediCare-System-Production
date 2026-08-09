import 'package:dartz/dartz.dart';


abstract class ClinicLocalDataSource {
  Future<Unit> getFromLocalDataBase();
}

class ClinicLocalDataSourceImpl implements ClinicLocalDataSource {
  ClinicLocalDataSourceImpl();

  @override
  Future<Unit> getFromLocalDataBase() async {
    // send api request here
    return Future.value(unit);
  }

}
  