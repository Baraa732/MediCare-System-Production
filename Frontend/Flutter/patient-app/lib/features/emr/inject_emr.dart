import 'package:cms/core/api/services/clinic_api_service.dart';
import 'package:cms/core/api/services/emr_api_service.dart';
import 'package:cms/features/emr/presentation/cubit/emr_cubit.dart';
import 'package:cms/injection_container.dart';

void injectEmr() {
  getIt.registerFactory(
    () => EmrCubit(getIt<EmrApiService>(), getIt<ClinicApiService>()),
  );
}
