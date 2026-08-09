import '../../domain/use_cases/auth_use_case.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'auth_state.dart';

class AuthCubit extends Cubit<AuthState> {
  final AuthUseCase authUseCase;

  AuthCubit({required this.authUseCase})
      : super(const AuthState(status: AuthStatus.initial));

  Future<void> fetchData() async {
    emit(state.copyWith(status: AuthStatus.loading));

    final result = await authUseCase.call();

    result.fold(
      (exception) => emit(
        state.copyWith(
          status: AuthStatus.error,
          errorMessage: exception.toString(),
        ),
      ),
      (_) => emit(
        state.copyWith(
          status: AuthStatus.loaded,
          errorMessage: null,
        ),
      ),
    );
  }
}
