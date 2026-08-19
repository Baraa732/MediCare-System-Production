import 'package:cms_doctor_app/app.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:cms_doctor_app/core/notifications/firebase_bootstrap.dart';
import 'package:flutter/material.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await FirebaseBootstrap.initialize();
  await initDoctorApp();
  runApp(const MyApp());
}
