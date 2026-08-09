import 'package:dartz/dartz.dart';
import 'package:cms/core/api/services/appointment_api_service.dart';

abstract class BookingRemoteDataSource {
  Future<Unit> callApi();
}

class BookingRemoteDataSourceImpl implements BookingRemoteDataSource {
  BookingRemoteDataSourceImpl(this._appointmentApi);

  final AppointmentApiService _appointmentApi;

  @override
  Future<Unit> callApi() async {
    await _appointmentApi.getMyAppointments(group: 'all');
    return unit;
  }
}
