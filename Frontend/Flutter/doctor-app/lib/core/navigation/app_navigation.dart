import 'package:flutter/material.dart';

import '../../features/notifications/notifications_screen.dart';
import '../../features/patients/patients_screen.dart';
import '../../features/schedule/day_view_screen.dart';
import '../../features/schedule/month_view_screen.dart';
import '../../features/schedule/week_view_screen.dart';
import '../../features/settings/settings_screen.dart';
import '../../features/shifts/shifts_screen.dart';

void showSnack(BuildContext context, String message) {
ScaffoldMessenger.of(context).showSnackBar(
SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
);
}

void openNotifications(BuildContext context) {
Navigator.push(
context,
MaterialPageRoute(builder: (_) => const NotificationsScreen()),
);
}

Route<void> instantRoute(Widget screen) => PageRouteBuilder<void>(
pageBuilder: (_, __, ___) => screen,
transitionDuration: Duration.zero,
reverseTransitionDuration: Duration.zero,
);

void switchMainTab(BuildContext context, int currentIndex, int index) {
if (index == currentIndex) return;
final Widget screen;
switch (index) {
case 0:
screen = const DayViewScreen();
case 1:
screen = const PatientsScreen();
case 2:
screen = const ShiftsScreen();
case 3:
screen = const SettingsScreen();
default:
return;
}
Navigator.pushReplacement(context, instantRoute(screen));
}

void switchScheduleTab(BuildContext context, int currentTab, int tab) {
if (tab == currentTab) return;
final Widget screen;
switch (tab) {
case 0:
screen = const DayViewScreen();
case 1:
screen = const WeekViewScreen();
case 2:
screen = const MonthViewScreen();
default:
return;
}
Navigator.pushReplacement(context, instantRoute(screen));
}
