import 'package:dartz/dartz.dart';
import 'package:cms/core/api/services/appointment_api_service.dart';

abstract class AppointmentRemoteDataSource {
  Future<Unit> callApi();
}

class AppointmentRemoteDataSourceImpl implements AppointmentRemoteDataSource {
  AppointmentRemoteDataSourceImpl(this._appointmentApi);

  final AppointmentApiService _appointmentApi;

  @override
  Future<Unit> callApi() async {
    await _appointmentApi.getMyAppointments(group: 'all');
    return unit;
  }
}
