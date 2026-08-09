import 'package:cms_doctor_app/core/api/api_client.dart';
import 'package:cms_doctor_app/core/api/services/appointment_api_service.dart';
import 'package:cms_doctor_app/core/api/services/auth_api_service.dart';
import 'package:cms_doctor_app/core/api/services/emr_api_service.dart';
import 'package:cms_doctor_app/core/api/services/notification_api_service.dart';
import 'package:cms_doctor_app/core/api/services/schedule_api_service.dart';
import 'package:cms_doctor_app/core/storage/session_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

late final SessionStorage sessionStorage;
late final ApiClient apiClient;
late final AuthApiService authApi;
late final AppointmentApiService appointmentApi;
late final EmrApiService emrApi;
late final NotificationApiService notificationApi;
late final ScheduleApiService scheduleApi;

Future<void> initDoctorApp() async {
  final prefs = await SharedPreferences.getInstance();
  sessionStorage = SessionStorage(prefs);
  apiClient = ApiClient(sessionStorage);
  authApi = AuthApiService(apiClient, sessionStorage);
  appointmentApi = AppointmentApiService(apiClient, sessionStorage);
  emrApi = EmrApiService(apiClient);
  notificationApi = NotificationApiService(apiClient);
  scheduleApi = ScheduleApiService(apiClient, sessionStorage);
}
