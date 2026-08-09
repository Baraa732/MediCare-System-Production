
import 'package:cms/core/entities/alert.dart';
import 'package:cms/core/entities/appointment.dart';
import 'package:cms/core/entities/clinic.dart';
import 'package:cms/core/entities/history.dart';

class HomeState {
  final bool isLoading;
  final String? errorMessage;
  final String? patientName;
  final String? patientPhone;
  final String? patientAvatarUrl;
  final List<Appointment> appointments;
  final List<Alert> alerts;
  final List<Clinic> clinics;
  final List<History> history;

  const HomeState({
    this.isLoading = false,
    this.errorMessage,
    this.patientName,
    this.patientPhone,
    this.patientAvatarUrl,
    this.appointments = const [],
    this.alerts = const [],
    this.clinics = const [],
    this.history = const [],
  });

  HomeState copyWith({
    bool? isLoading,
    String? errorMessage,
    String? patientName,
    String? patientPhone,
    String? patientAvatarUrl,
    List<Appointment>? appointments,
    List<Alert>? alerts,
    List<Clinic>? clinics,
    List<History>? history,
  }) {
    return HomeState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      patientName: patientName ?? this.patientName,
      patientPhone: patientPhone ?? this.patientPhone,
      patientAvatarUrl: patientAvatarUrl ?? this.patientAvatarUrl,
      appointments: appointments ?? this.appointments,
      alerts: alerts ?? this.alerts,
      clinics: clinics ?? this.clinics,
      history: history ?? this.history,
    );
  }
}
