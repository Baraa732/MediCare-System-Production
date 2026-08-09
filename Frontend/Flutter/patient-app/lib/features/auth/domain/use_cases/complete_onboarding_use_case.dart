// lib/features/auth/domain/use_cases/complete_onboarding_use_case.dart
import 'package:cms/features/auth/data/data_sources/local/auth_local_data_source.dart';

class CompleteOnboardingUseCase {
  final AuthLocalDataSource localDataSource;

  CompleteOnboardingUseCase(this.localDataSource);

  Future<void> call() async {
    await localDataSource.setOnboardingCompleted();
  }
}