import 'package:cms/core/animations/app_page_route.dart';
import 'package:cms/core/entities/appointment.dart';
import 'package:cms/core/entities/clinic.dart';
import 'package:cms/core/navigation/app_navigator.dart';
import 'package:cms/core/notifications/firebase_bootstrap.dart';
import 'package:cms/core/notifications/push_notification_service.dart';
import 'package:cms/core/storage/session_storage.dart';
import 'package:cms/features/appointment/presentation/screens/appointment_detail_screen.dart';
import 'package:cms/features/auth/presentation/screens/splash_screen.dart';
import 'package:cms/features/auth/presentation/screens/login_screen.dart';
import 'package:cms/features/auth/presentation/screens/signup_screen.dart';
import 'package:cms/features/auth/presentation/screens/forgot_password_screen.dart';
import 'package:cms/features/auth/presentation/screens/otp_screen.dart';
import 'package:cms/features/auth/presentation/screens/on_bording_screen.dart';
import 'package:cms/features/auth/presentation/screens/welcome_screen.dart';
import 'package:cms/features/booking/presentation/screens/booking_form_screen.dart';
import 'package:cms/features/booking/presentation/screens/booking_screen.dart';
import 'package:cms/features/booking/presentation/screens/booking_success_screen.dart';
import 'package:cms/features/clinic/presentation/screens/clinic_detail_screen.dart';
import 'package:cms/features/home/presentation/screens/home_screen.dart';
import 'package:cms/features/map/presentation/screens/map_screen.dart';
import 'package:cms/features/map/presentation/screens/map_test_screen.dart';
import 'package:cms/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:cms/features/profile/presentation/cubit/profile_cubit.dart';
import 'package:cms/features/profile/presentation/screens/edit_profile_screen.dart';
import 'package:cms/features/profile/presentation/screens/profile_screen.dart';
import 'package:cms/features/search/presentation/screens/filter_screen.dart';
import 'package:cms/features/search/presentation/screens/search_screen.dart';
import 'package:cms/features/search/presentation/cubit/searchresult_cubit.dart';
import 'package:cms/features/search/presentation/screens/searchresult_screen.dart';
import 'package:cms/injection_container.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await init();

  // Firebase + background handler must be registered before runApp.
  await FirebaseBootstrap.initialize();

  runApp(const MyApp());

  WidgetsBinding.instance.addPostFrameCallback((_) {
    _initializePushNotifications();
  });
}

Future<void> _initializePushNotifications() async {
  try {
    final pushService = getIt<PushNotificationService>();
    await pushService.initialize();
    if (getIt<SessionStorage>().isLoggedIn) {
      await pushService.onUserAuthenticated();
    }
  } catch (e, stack) {
    debugPrint('Push notifications init skipped: $e\n$stack');
  }
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CMS',
      navigatorKey: appNavigatorKey,
      theme: ThemeData(primarySwatch: Colors.blue),
      initialRoute: '/splash',
      onGenerateRoute: (settings) {
        switch (settings.name) {
          case '/splash':
            return AppPageRoute(
              settings: settings,
              builder: (_) => const SplashScreen(),
            );
          case '/welcome':
            return AppPageRoute(
              settings: settings,
              builder: (_) => const WelcomeScreen(),
            );
          case '/onboarding':
            return AppPageRoute(
              settings: settings,
              builder: (_) => OnBordingScreen(),
            );
          case LoginScreen.routeName:
            return AppPageRoute(
              settings: settings,
              builder: (_) => const LoginScreen(),
            );
          case SignupScreen.routeName:
            return AppPageRoute(
              settings: settings,
              builder: (_) => const SignupScreen(),
            );
          case ForgotPasswordScreen.routeName:
            return AppPageRoute(
              settings: settings,
              builder: (_) => const ForgotPasswordScreen(),
            );
          case OtpScreen.routeName:
            final phone = settings.arguments as String? ?? '';
            return AppPageRoute(
              settings: settings,
              builder: (_) => OtpScreen(phoneNumber: phone),
            );
          case HomeScreen.routeName:
            final tab = settings.arguments is int
                ? settings.arguments as int
                : 0;
            return AppPageRoute(
              settings: settings,
              builder: (_) => HomeScreen(initialTab: tab),
            );
          case AppointmentDetailScreen.routeName:
            final appointment = settings.arguments;
            return AppPageRoute(
              settings: settings,
              builder: (_) => AppointmentDetailScreen(
                appointment: appointment as Appointment,
              ),
            );
          case ClinicDetailScreen.routeName:
            final clinic = settings.arguments;
            return AppPageRoute(
              settings: settings,
              builder: (_) => ClinicDetailScreen(clinic: clinic as Clinic),
            );
          case MapTestScreen.routeName:
            final clinic = settings.arguments;
            return AppPageRoute(
              settings: settings,
              builder: (_) => MapTestScreen(clinic: clinic as Clinic?),
            );
          case SearchScreen.routeName:
            return AppPageRoute(
              settings: settings,
              builder: (_) => const SearchScreen(),
            );
          case SearchResultsScreen.routeName:
            final query = settings.arguments as String? ?? '';
            return AppPageRoute(
              settings: settings,
              builder: (_) => BlocProvider(
                create: (_) => getIt<SearchResultsCubit>()..search(query),
                child: SearchResultsScreen(query: query),
              ),
            );
          case FilterScreen.routeName:
            return AppPageRoute(
              settings: settings,
              builder: (_) => const FilterScreen(),
            );
          case MapScreen.routeName:
            return AppPageRoute(
              settings: settings,
              builder: (_) => const MapScreen(),
            );
          case BookingScreen.routeName:
            return AppPageRoute(
              settings: settings,
              builder: (_) => const BookingScreen(),
            );
          case ProfileScreen.routeName:
            return AppPageRoute(
              settings: settings,
              builder: (_) => BlocProvider(
                create: (_) => getIt<ProfileCubit>()..loadProfile(),
                child: const ProfileScreen(),
              ),
            );
          case EditProfileScreen.routeName:
            return AppPageRoute(
              settings: settings,
              builder: (_) => const EditProfileScreen(),
            );
          case NotificationsScreen.routeName:
            return AppPageRoute(
              settings: settings,
              builder: (_) => const NotificationsScreen(),
            );
          case BookingFormScreen.routeName:
            final clinic = settings.arguments as Clinic?;
            return AppPageRoute(
              settings: settings,
              builder: (_) => BookingFormScreen(clinic: clinic),
            );
          case BookingSuccessScreen.routeName:
            return AppPageRoute(
              settings: settings,
              builder: (_) => const BookingSuccessScreen(),
            );
          default:
            return AppPageRoute(
              settings: settings,
              builder: (_) =>
                  const Scaffold(body: Center(child: Text('Page not found'))),
            );
        }
      },
    );
  }
}
