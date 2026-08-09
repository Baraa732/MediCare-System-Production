import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../injection_container.dart';
import '../cubit/clinic_cubit.dart';
import '../cubit/clinic_state.dart';

class ClinicScreen extends StatefulWidget {
  static const routeName = "/clinic";
  const ClinicScreen({super.key});

  @override
  State<ClinicScreen> createState() => _ClinicScreenState();
}

class _ClinicScreenState extends State<ClinicScreen> {
  @override
  void initState() {
    super.initState();
    // You can call Cubit methods here if needed, e.g.:
    // context.read<ClinicCubit>().fetchData();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => getIt<ClinicCubit>(),
      child: BlocBuilder<ClinicCubit, ClinicState>(
        builder: (context, state) {
          if (state.status == ClinicStatus.loading) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }

          if (state.status == ClinicStatus.error) {
            return Scaffold(
              body: Center(
                child: Text(state.errorMessage ?? 'an_error_occurred'),
              ),
            );
          }

          if (state.status == ClinicStatus.loaded) {
            // TODO: Replace this with your actual loaded UI
            return const Scaffold(
              body: Center(child: Text('Data Loaded')),
            );
          }

          return Scaffold(
            body: Center(
              child: Text('clinic screen'),
            ),
          );
        },
      ),
    );
  }
}
