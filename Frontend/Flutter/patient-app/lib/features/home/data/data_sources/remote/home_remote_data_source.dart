import 'package:dartz/dartz.dart';
import 'package:cms/core/api/services/clinic_api_service.dart';

abstract class HomeRemoteDataSource {
  Future<Unit> callApi();
}

class HomeRemoteDataSourceImpl implements HomeRemoteDataSource {
  HomeRemoteDataSourceImpl(this._clinicApi);

  final ClinicApiService _clinicApi;

  @override
  Future<Unit> callApi() async {
    await _clinicApi.listClinics();
    return unit;
  }
}
