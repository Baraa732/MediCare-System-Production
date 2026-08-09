import 'package:dartz/dartz.dart';
import 'package:cms/core/api/services/clinic_api_service.dart';

abstract class MapRemoteDataSource {
  Future<Unit> callApi();
}

class MapRemoteDataSourceImpl implements MapRemoteDataSource {
  MapRemoteDataSourceImpl(this._clinicApi);

  final ClinicApiService _clinicApi;

  @override
  Future<Unit> callApi() async {
    await _clinicApi.listClinics();
    return unit;
  }
}
