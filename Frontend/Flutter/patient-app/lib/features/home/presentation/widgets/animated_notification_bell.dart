import 'dart:math' as math;

import 'package:cms/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

/// Pulsing / ringing notification control for the home header.
class AnimatedNotificationBell extends StatefulWidget {
  const AnimatedNotificationBell({
    super.key,
    required this.onTap,
    this.hasUnread = true,
  });

  final VoidCallback onTap;
  final bool hasUnread;

  @override
  State<AnimatedNotificationBell> createState() =>
      _AnimatedNotificationBellState();
}

class _AnimatedNotificationBellState extends State<AnimatedNotificationBell>
    with TickerProviderStateMixin {
  late final AnimationController _ringController;
  late final AnimationController _pulseController;
  late final AnimationController _pressController;
  late final Animation<double> _ring;
  late final Animation<double> _pulse;
  late final Animation<double> _press;

  @override
  void initState() {
    super.initState();
    _ringController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    );
    _pressController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 140),
    );

    _ring = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0, end: 0.18), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 0.18, end: -0.16), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -0.16, end: 0.12), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 0.12, end: -0.08), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -0.08, end: 0), weight: 1),
    ]).animate(CurvedAnimation(parent: _ringController, curve: Curves.easeOut));

    _pulse = Tween<double>(begin: 0.85, end: 1.35).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeOut),
    );
    _press = Tween<double>(begin: 1, end: 0.9).animate(
      CurvedAnimation(parent: _pressController, curve: Curves.easeOut),
    );

    if (widget.hasUnread) {
      _startLoops();
    }
  }

  void _startLoops() {
    Future<void>.delayed(const Duration(milliseconds: 600), () {
      if (!mounted) return;
      _ringController.forward(from: 0);
    });
    _pulseController.repeat(reverse: true);
    Future<void>.delayed(const Duration(seconds: 4), _scheduleRing);
  }

  void _scheduleRing() {
    if (!mounted || !widget.hasUnread) return;
    _ringController.forward(from: 0).whenComplete(() {
      Future<void>.delayed(const Duration(seconds: 5), _scheduleRing);
    });
  }

  @override
  void didUpdateWidget(covariant AnimatedNotificationBell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.hasUnread && !oldWidget.hasUnread) {
      _startLoops();
    } else if (!widget.hasUnread && oldWidget.hasUnread) {
      _pulseController.stop();
      _ringController.stop();
    }
  }

  @override
  void dispose() {
    _ringController.dispose();
    _pulseController.dispose();
    _pressController.dispose();
    super.dispose();
  }

  Future<void> _handleTap() async {
    await _pressController.forward();
    await _pressController.reverse();
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _handleTap,
      child: AnimatedBuilder(
        animation: Listenable.merge([
          _ringController,
          _pulseController,
          _pressController,
        ]),
        builder: (context, _) {
          return Transform.scale(
            scale: _press.value,
            child: Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.12),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Stack(
                alignment: Alignment.center,
                clipBehavior: Clip.none,
                children: [
                  if (widget.hasUnread)
                    Transform.scale(
                      scale: _pulse.value,
                      child: Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.main_background_blue
                              .withValues(alpha: 0.12 * (2 - _pulse.value)),
                        ),
                      ),
                    ),
                  Transform.rotate(
                    angle: widget.hasUnread ? _ring.value * math.pi : 0,
                    child: const Icon(
                      Icons.notifications_active_rounded,
                      color: AppColors.main_background_blue,
                      size: 26,
                    ),
                  ),
                  if (widget.hasUnread)
                    Positioned(
                      top: 8,
                      right: 9,
                      child: Container(
                        width: 9,
                        height: 9,
                        decoration: BoxDecoration(
                          color: AppColors.orange,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 1.5),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.orange.withValues(alpha: 0.55),
                              blurRadius: 6,
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
