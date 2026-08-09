import 'package:cms/core/api/api_exception.dart';
import 'package:cms/core/api/services/auth_api_service.dart';
import 'package:cms/features/auth/presentation/cubit/forgot_password_cubit.dart';
import 'package:cms/features/auth/presentation/cubit/signup_cubit.dart';
import 'package:cms/injection_container.dart';
import 'data/data_sources/local/auth_local_data_source.dart';
import 'domain/use_cases/check_onboarding_use_case.dart';
import 'domain/use_cases/complete_onboarding_use_case.dart';
import 'presentation/cubit/login_cubit.dart';

final sl = getIt;

void initAuthInjection() {
  sl.registerLazySingleton<AuthLocalDataSource>(() => AuthLocalDataSource());

  sl.registerLazySingleton<CheckOnboardingUseCase>(
    () => CheckOnboardingUseCase(sl()),
  );
  sl.registerLazySingleton<CompleteOnboardingUseCase>(
    () => CompleteOnboardingUseCase(sl()),
  );

  sl.registerFactory<LoginCubit>(() => LoginCubit(sl<AuthApiService>()));
  sl.registerFactory<ForgotPasswordCubit>(
    () => ForgotPasswordCubit(sl<AuthApiService>()),
  );
  sl.registerFactory<SignupCubit>(() => SignupCubit(sl<AuthApiService>()));
}
