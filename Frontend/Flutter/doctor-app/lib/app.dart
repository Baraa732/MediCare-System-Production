import 'package:cms_doctor_app/features/auth/splash_screen.dart';
import 'package:flutter/material.dart';

import 'core/navigation/app_navigation.dart';
import 'features/notifications/notifications_screen.dart';

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MediCare Doctor',
      debugShowCheckedModeBanner: false,
      navigatorKey: appNavigatorKey,
      theme: ThemeData(
        fontFamily: 'Inter',
        primaryColor: const Color(0xFF0B74FA),
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0B74FA)),
      ),
      routes: {
        '/notifications': (_) => const NotificationsScreen(),
      },
      home: const SplashScreen(),
    );
  }
}
