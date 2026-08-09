import 'package:dartz/dartz.dart';
import 'package:cms/core/api/services/clinic_api_service.dart';

abstract class SearchRemoteDataSource {
  Future<Unit> callApi();
}

class SearchRemoteDataSourceImpl implements SearchRemoteDataSource {
  SearchRemoteDataSourceImpl(this._clinicApi);

  final ClinicApiService _clinicApi;

  @override
  Future<Unit> callApi() async {
    await _clinicApi.searchClinics(query: '');
    return unit;
  }
}
