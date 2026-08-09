// lib/features/auth/presentation/cubit/onboarding_cubit.dart
import 'package:cms/features/auth/domain/use_cases/check_onboarding_use_case.dart';
import 'package:cms/features/auth/domain/use_cases/complete_onboarding_use_case.dart';
import 'package:cms/features/auth/presentation/cubit/onboarding_state.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class OnboardingCubit extends Cubit<OnboardingState> {
  final CheckOnboardingUseCase checkOnboarding;
  final CompleteOnboardingUseCase completeOnboarding;

  OnboardingCubit({
    required this.checkOnboarding,
    required this.completeOnboarding,
  }) : super(OnboardingInitial());

  Future<void> checkStatus() async {
    final result = await checkOnboarding();
    if (result) {
      emit(OnboardingCompleted());
    } else {
      emit(OnboardingNotCompleted());
    }
  }

  Future<void> complete() async {
    await completeOnboarding();
    emit(OnboardingCompleted());
  }
}

