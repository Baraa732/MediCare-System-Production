import 'package:dartz/dartz.dart';
import 'package:cms/core/api/services/user_api_service.dart';

abstract class ProfileRemoteDataSource {
  Future<Unit> callApi();
}

class ProfileRemoteDataSourceImpl implements ProfileRemoteDataSource {
  ProfileRemoteDataSourceImpl(this._userApi);

  final UserApiService _userApi;

  @override
  Future<Unit> callApi() async {
    // noop placeholder for repository chain
    return unit;
  }
}
