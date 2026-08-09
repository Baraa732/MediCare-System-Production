import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/constants/app_assets.dart';
import '../schedule/day_view_screen.dart';
import 'shifts_screen.dart';

class RequestDoneScreen extends StatelessWidget {
const RequestDoneScreen({super.key});
@override
Widget build(BuildContext context) => Scaffold(
backgroundColor: Colors.white,
body: Column(children: [
Container(
color: const Color(0xFF0B74FA),
padding: const EdgeInsets.only(top: 48, left: 16, right: 16, bottom: 14),
child: Row(children: [
GestureDetector(
onTap: () => Navigator.pushAndRemoveUntil(
context,
MaterialPageRoute(builder: (_) => const ShiftsScreen()),
(r) => false,
),
child: const Icon(Icons.arrow_back, color: Colors.white),
),
const SizedBox(width: 8),
const Text('Back to home', style: TextStyle(fontSize: 16, color: Colors.white)),
]),
),
Expanded(
child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
SvgPicture.asset(AppAssets.requestDone, width: 118, height: 118),
const SizedBox(height: 24),
const Text('Request Submitted', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Color(0xFF1A1B1E))),
const SizedBox(height: 8),
const Padding(
padding: EdgeInsets.symmetric(horizontal: 40),
child: Text(
'You will receive a notification once the admin confirms your leave request',
textAlign: TextAlign.center,
style: TextStyle(fontSize: 16, color: Color(0xFF929296), height: 1.6),
),
),
const SizedBox(height: 16),
const Text('Pending Review', style: TextStyle(fontSize: 16, color: Color(0xFFE65C00), fontWeight: FontWeight.w500)),
]),
),
Padding(
padding: const EdgeInsets.all(20),
child: SizedBox(
width: double.infinity,
child: ElevatedButton(
onPressed: () => Navigator.pushAndRemoveUntil(
context,
MaterialPageRoute(builder: (_) => const DayViewScreen()),
(r) => false,
),
style: ElevatedButton.styleFrom(
backgroundColor: const Color(0xFF0B74FA),
foregroundColor: Colors.white,
padding: const EdgeInsets.symmetric(vertical: 14),
shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
elevation: 0,
),
child: const Text('Back to Home', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
),
),
),
]),
);
}
