import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../injection_container.dart';
import '../cubit/appointment_cubit.dart';
import '../cubit/appointment_state.dart';

class AppointmentScreen extends StatefulWidget {
  static const routeName = "/appointment";
  const AppointmentScreen({super.key});

  @override
  State<AppointmentScreen> createState() => _AppointmentScreenState();
}

class _AppointmentScreenState extends State<AppointmentScreen> {
  @override
  void initState() {
    super.initState();
    // You can call Cubit methods here if needed, e.g.:
    // context.read<AppointmentCubit>().fetchData();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => getIt<AppointmentCubit>(),
      child: BlocBuilder<AppointmentCubit, AppointmentState>(
        builder: (context, state) {
          if (state.status == AppointmentStatus.loading) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }

          if (state.status == AppointmentStatus.error) {
            return Scaffold(
              body: Center(
                child: Text(state.errorMessage ?? 'an_error_occurred'),
              ),
            );
          }

          if (state.status == AppointmentStatus.loaded) {
            // TODO: Replace this with your actual loaded UI
            return const Scaffold(
              body: Center(child: Text('Data Loaded')),
            );
          }

          return Scaffold(
            body: Center(
              child: Text('appointment screen'),
            ),
          );
        },
      ),
    );
  }
}
