import 'package:cms_doctor_app/app.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initDoctorApp();
  runApp(const MyApp());
}
