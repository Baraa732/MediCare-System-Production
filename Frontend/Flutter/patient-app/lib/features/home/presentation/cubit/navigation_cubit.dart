import 'package:flutter_bloc/flutter_bloc.dart';
import 'navigation_state.dart';

class NavigationCubit extends Cubit<NavigationState> {
  NavigationCubit() : super(const NavigationState());

  void selectTab(int index) {
    if (state.selectedIndex != index) {
      emit(state.copyWith(selectedIndex: index));
    }
  }
}