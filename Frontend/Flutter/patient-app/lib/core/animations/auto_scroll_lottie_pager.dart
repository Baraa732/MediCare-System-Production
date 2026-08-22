import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

/// Full-bleed auto-scrolling Lottie carousel for splash / hero moments.
class AutoScrollLottiePager extends StatefulWidget {
  const AutoScrollLottiePager({
    super.key,
    required this.assets,
    this.height,
    this.interval = const Duration(milliseconds: 2800),
    this.viewportFraction = 0.86,
    this.repeat = true,
    this.onPageChanged,
  });

  final List<String> assets;
  final double? height;
  final Duration interval;
  final double viewportFraction;
  final bool repeat;
  final ValueChanged<int>? onPageChanged;

  @override
  State<AutoScrollLottiePager> createState() => _AutoScrollLottiePagerState();
}

class _AutoScrollLottiePagerState extends State<AutoScrollLottiePager> {
  late final PageController _controller;
  Timer? _timer;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _controller = PageController(viewportFraction: widget.viewportFraction);
    _startAutoScroll();
  }

  void _startAutoScroll() {
    if (widget.assets.length < 2) return;
    _timer?.cancel();
    _timer = Timer.periodic(widget.interval, (_) {
      if (!mounted || !_controller.hasClients) return;
      final next = (_index + 1) % widget.assets.length;
      _controller.animateToPage(
        next,
        duration: const Duration(milliseconds: 520),
        curve: Curves.easeInOutCubic,
      );
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final height = widget.height ?? MediaQuery.sizeOf(context).height * 0.42;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: height,
          child: PageView.builder(
            controller: _controller,
            itemCount: widget.assets.length,
            onPageChanged: (i) {
              setState(() => _index = i);
              widget.onPageChanged?.call(i);
            },
            itemBuilder: (context, i) {
              final active = i == _index;
              return AnimatedScale(
                scale: active ? 1 : 0.9,
                duration: const Duration(milliseconds: 320),
                curve: Curves.easeOutCubic,
                child: AnimatedOpacity(
                  opacity: active ? 1 : 0.55,
                  duration: const Duration(milliseconds: 320),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    child: Lottie.asset(
                      widget.assets[i],
                      fit: BoxFit.contain,
                      repeat: widget.repeat,
                      errorBuilder: (_, __, ___) => Icon(
                        Icons.local_hospital_rounded,
                        size: height * 0.28,
                        color: Colors.white.withValues(alpha: 0.75),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        if (widget.assets.length > 1) ...[
          const SizedBox(height: 18),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(widget.assets.length, (i) {
              final active = i == _index;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 280),
                margin: const EdgeInsets.symmetric(horizontal: 4),
                height: 8,
                width: active ? 22 : 8,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: active ? 1 : 0.35),
                  borderRadius: BorderRadius.circular(99),
                ),
              );
            }),
          ),
        ],
      ],
    );
  }
}
