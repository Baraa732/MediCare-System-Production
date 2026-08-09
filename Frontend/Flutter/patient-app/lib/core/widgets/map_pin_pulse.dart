import 'package:flutter/material.dart';

/// Overlay pulse rings for a selected map pin (SM-dashboard style).
class MapPinPulse extends StatefulWidget {
  const MapPinPulse({
    super.key,
    this.color = const Color(0xFF0B74FA),
    this.size = 56,
  });

  final Color color;
  final double size;

  @override
  State<MapPinPulse> createState() => _MapPinPulseState();
}

class _MapPinPulseState extends State<MapPinPulse>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          return CustomPaint(
            painter: _PulsePainter(
              progress: _controller.value,
              color: widget.color,
            ),
          );
        },
      ),
    );
  }
}

class _PulsePainter extends CustomPainter {
  _PulsePainter({required this.progress, required this.color});

  final double progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final maxR = size.shortestSide / 2;

    for (var i = 0; i < 2; i++) {
      final t = (progress + i * 0.5) % 1.0;
      final radius = maxR * (0.25 + t * 0.75);
      final opacity = (1.0 - t).clamp(0.0, 1.0) * 0.45;
      final paint = Paint()
        ..color = color.withValues(alpha: opacity)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2;
      canvas.drawCircle(center, radius, paint);
    }

    final dot = Paint()..color = color;
    canvas.drawCircle(center, maxR * 0.16, dot);
  }

  @override
  bool shouldRepaint(covariant _PulsePainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.color != color;
}
