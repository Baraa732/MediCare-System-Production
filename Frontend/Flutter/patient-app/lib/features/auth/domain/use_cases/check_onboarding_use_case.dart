// lib/features/auth/domain/use_cases/check_onboarding_use_case.dart
import 'package:cms/features/auth/data/data_sources/local/auth_local_data_source.dart';

class CheckOnboardingUseCase {
  final AuthLocalDataSource localDataSource;

  CheckOnboardingUseCase(this.localDataSource);

  Future<bool> call() async {
    return await localDataSource.isOnboardingCompleted();
  }
}