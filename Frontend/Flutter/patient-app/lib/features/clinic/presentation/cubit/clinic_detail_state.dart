import 'package:cms/core/entities/clinic.dart';
import 'package:cms/core/entities/doctor.dart';

class ClinicDetailState {
  final bool isLoading;
  final String? errorMessage;
  final Clinic? clinic;
  final List<Doctor> doctors;

  const ClinicDetailState({
    this.isLoading = false,
    this.errorMessage,
    this.clinic,
    this.doctors = const [],
  });

  ClinicDetailState copyWith({
    bool? isLoading,
    String? errorMessage,
    Clinic? clinic,
    List<Doctor>? doctors,
  }) {
    return ClinicDetailState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      clinic: clinic ?? this.clinic,
      doctors: doctors ?? this.doctors,
    );
  }
}
