import 'package:cms/features/booking/presentation/screens/booking_screen.dart';
import 'package:flutter/material.dart';

/// Legacy route — appointments live on the Books tab (`BookingScreen`).
class AppointmentScreen extends StatelessWidget {
  static const routeName = "/appointment";
  const AppointmentScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const BookingScreen();
  }
}
