import 'package:flutter/material.dart';

/// Fade + slight slide-up page transition (~280ms).
class AppPageRoute<T> extends PageRouteBuilder<T> {
  AppPageRoute({
    required WidgetBuilder builder,
    super.settings,
    Duration duration = const Duration(milliseconds: 280),
  }) : super(
          pageBuilder: (context, animation, secondaryAnimation) =>
              builder(context),
          transitionDuration: duration,
          reverseTransitionDuration: duration,
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            final curved = CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutCubic,
              reverseCurve: Curves.easeInCubic,
            );
            return FadeTransition(
              opacity: curved,
              child: SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(0, 0.04),
                  end: Offset.zero,
                ).animate(curved),
                child: child,
              ),
            );
          },
        );
}

/// Convenience helper matching [MaterialPageRoute] call sites.
AppPageRoute<T> appPageRoute<T>({
  required WidgetBuilder builder,
  RouteSettings? settings,
}) {
  return AppPageRoute<T>(builder: builder, settings: settings);
}
