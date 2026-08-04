import 'package:flutter/material.dart';

/// Global navigator for notification tap → deep link routing.
final GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();

void openNotificationsFromPush() {
  final navigator = appNavigatorKey.currentState;
  if (navigator == null) return;
  navigator.pushNamed('/notifications');
}
