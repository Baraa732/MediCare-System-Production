import 'package:cms/core/api/api_exception.dart';
import 'package:cms/core/api/entity_mappers.dart';
import 'package:cms/core/api/services/appointment_api_service.dart';
import 'package:cms/core/api/services/clinic_api_service.dart';
import 'package:cms/core/api/services/notification_api_service.dart';
import 'package:cms/core/api/services/user_api_service.dart';
import 'package:cms/core/entities/alert.dart';
import 'package:cms/core/entities/appointment.dart';
import 'package:cms/core/entities/clinic.dart';
import 'package:cms/core/entities/history.dart';
import 'package:cms/core/storage/session_storage.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'home_state.dart';

class HomeCubit extends Cubit<HomeState> {
  HomeCubit({
    required ClinicApiService clinicApi,
    required AppointmentApiService appointmentApi,
    required NotificationApiService notificationApi,
    required UserApiService userApi,
    required SessionStorage sessionStorage,
  })  : _clinicApi = clinicApi,
        _appointmentApi = appointmentApi,
        _notificationApi = notificationApi,
        _userApi = userApi,
        _sessionStorage = sessionStorage,
        super(const HomeState());

  final ClinicApiService _clinicApi;
  final AppointmentApiService _appointmentApi;
  final NotificationApiService _notificationApi;
  final UserApiService _userApi;
  final SessionStorage _sessionStorage;

  Future<void> loadHomeData() async {
    emit(state.copyWith(isLoading: true, errorMessage: null));

    List<Appointment> appointments = [];
    List<Clinic> clinics = [];
    List<Alert> alerts = [];
    List<History> history = [];
    String? patientName;
    String? patientPhone;
    String? patientAvatarUrl;
    String? errorMessage;

    final userId = _sessionStorage.userId;
    if (userId != null && userId.isNotEmpty) {
      try {
        final profile = await _userApi.getProfile(userId);
        patientName = profile.fullName;
        patientPhone = profile.phoneNumber;
        patientAvatarUrl = profile.avatarUrl;
      } catch (_) {}
    }

    try {
      clinics = await _clinicApi.listClinics();
    } on ApiException catch (e) {
      errorMessage = e.message;
    } catch (_) {
      errorMessage = 'Could not load clinics.';
    }

    try {
      appointments =
          await _appointmentApi.getMyAppointments(group: 'upcoming');
    } catch (_) {}

    try {
      final pastAppointments =
          await _appointmentApi.getMyAppointments(group: 'past');
      history = pastAppointments
          .take(5)
          .map(
            (a) => History(
              id: a.id,
              clinicName: a.clinicName,
              location: a.specialty,
              timeVisited: '${a.date} ${a.time}',
            ),
          )
          .toList();
    } catch (_) {}

    try {
      final notifications =
          await _notificationApi.getMyNotifications(limit: 5);
      alerts = notifications
          .map((n) => EntityMappers.alertFromNotification(n))
          .cast<Alert>()
          .toList();
    } catch (_) {}

    emit(state.copyWith(
      isLoading: false,
      errorMessage: errorMessage,
      patientName: patientName,
      patientPhone: patientPhone,
      patientAvatarUrl: patientAvatarUrl,
      appointments: appointments,
      alerts: alerts,
      clinics: clinics,
      history: history,
    ));
  }
}
