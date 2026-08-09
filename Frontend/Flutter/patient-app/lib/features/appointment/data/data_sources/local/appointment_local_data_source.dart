import 'package:dartz/dartz.dart';


abstract class AppointmentLocalDataSource {
  Future<Unit> getFromLocalDataBase();
}

class AppointmentLocalDataSourceImpl implements AppointmentLocalDataSource {
  AppointmentLocalDataSourceImpl();

  @override
  Future<Unit> getFromLocalDataBase() async {
    // send api request here
    return Future.value(unit);
  }

}
  