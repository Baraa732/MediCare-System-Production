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
import 'package:cms/features/auth/presentation/screens/forgot_password_otp_screen.dart';
import 'package:cms/features/auth/presentation/screens/reset_password_screen.dart';
import 'package:cms/features/auth/presentation/screens/otp_screen.dart';
import 'package:cms/features/auth/presentation/screens/on_bording_screen.dart';
import 'package:cms/features/auth/presentation/screens/welcome_screen.dart';
import 'package:cms/features/booking/presentation/screens/booking_form_screen.dart';
import 'package:cms/features/booking/presentation/screens/booking_screen.dart';
import 'package:cms/features/booking/presentation/screens/booking_success_screen.dart';
import 'package:cms/features/clinic/presentation/screens/clinic_detail_screen.dart';
import 'package:cms/features/emr/presentation/screens/emr_screen.dart';
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
import 'package:cms/core/theme/app_colors.dart';
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
      title: 'MediCare Patient',
      navigatorKey: appNavigatorKey,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.main_background_blue,
          primary: AppColors.main_background_blue,
          onPrimary: Colors.white,
          surface: Colors.white,
          onSurface: const Color(0xFF1A1B1E),
        ),
        scaffoldBackgroundColor: const Color(0xFFF5F7FB),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Color(0xFF1A1B1E),
          surfaceTintColor: Colors.transparent,
        ),
        dialogTheme: DialogThemeData(
          backgroundColor: Colors.white,
          titleTextStyle: const TextStyle(
            color: Color(0xFF1A1B1E),
            fontSize: 20,
            fontWeight: FontWeight.w700,
          ),
          contentTextStyle: const TextStyle(
            color: Color(0xFF6F7076),
            fontSize: 15,
          ),
        ),
        listTileTheme: const ListTileThemeData(
          iconColor: AppColors.main_background_blue,
          textColor: Color(0xFF1A1B1E),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.main_background_blue,
            foregroundColor: Colors.white,
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            foregroundColor: Colors.white,
          ),
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            foregroundColor: AppColors.main_background_blue,
          ),
        ),
      ),
      // Use `home` instead of `initialRoute: '/splash'`.
      // With initialRoute '/splash', Flutter also pushes '/', which hit the
      // default case and showed "Page not found" under the splash.
      home: const SplashScreen(),
      onGenerateRoute: (settings) {
        switch (settings.name) {
          case '/':
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
          case ForgotPasswordOtpScreen.routeName:
            final phone = settings.arguments as String? ?? '';
            return AppPageRoute(
              settings: settings,
              builder: (_) => ForgotPasswordOtpScreen(phoneNumber: phone),
            );
          case ResetPasswordScreen.routeName:
            final args = settings.arguments as ResetPasswordArgs?;
            return AppPageRoute(
              settings: settings,
              builder: (_) => ResetPasswordScreen(
                args: args ??
                    const ResetPasswordArgs(phoneNumber: '', otp: ''),
              ),
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
          case EmrScreen.routeName:
            return AppPageRoute(
              settings: settings,
              builder: (_) => const EmrScreen(),
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
