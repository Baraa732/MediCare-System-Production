import 'dart:math' as math;

import 'package:cms/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

/// Animated “doctor holding a lens” hero for search idle/empty states.
class DoctorSearchHero extends StatefulWidget {
  const DoctorSearchHero({super.key, this.size = 160});

  final double size;

  @override
  State<DoctorSearchHero> createState() => _DoctorSearchHeroState();
}

class _DoctorSearchHeroState extends State<DoctorSearchHero>
    with TickerProviderStateMixin {
  late final AnimationController _bob;
  late final AnimationController _wave;
  late final AnimationController _lens;

  @override
  void initState() {
    super.initState();
    _bob = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
    _wave = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
    _lens = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _bob.dispose();
    _wave.dispose();
    _lens.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = widget.size;
    return AnimatedBuilder(
      animation: Listenable.merge([_bob, _wave, _lens]),
      builder: (context, _) {
        final bobY = Tween<double>(begin: -6, end: 6).transform(
          Curves.easeInOut.transform(_bob.value),
        );
        final wave = Tween<double>(begin: -0.18, end: 0.22).transform(
          Curves.easeInOut.transform(_wave.value),
        );
        final lensScale = Tween<double>(begin: 0.92, end: 1.08).transform(
          Curves.easeInOut.transform(_lens.value),
        );

        return SizedBox(
          width: size,
          height: size,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: size * 0.82,
                height: size * 0.82,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      AppColors.main_background_blue.withValues(alpha: 0.16),
                      AppColors.main_background_blue.withValues(alpha: 0.02),
                    ],
                  ),
                ),
              ),
              Transform.translate(
                offset: Offset(0, bobY),
                child: Stack(
                  alignment: Alignment.center,
                  clipBehavior: Clip.none,
                  children: [
                    Icon(
                      Icons.medical_services_rounded,
                      size: size * 0.42,
                      color: AppColors.main_background_blue,
                    ),
                    Positioned(
                      right: size * 0.12,
                      bottom: size * 0.22,
                      child: Transform.rotate(
                        angle: wave,
                        child: Transform.scale(
                          scale: lensScale,
                          child: Container(
                            width: size * 0.34,
                            height: size * 0.34,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.white,
                              border: Border.all(
                                color: AppColors.main_background_blue,
                                width: 4,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.main_background_blue
                                      .withValues(alpha: 0.25),
                                  blurRadius: 12,
                                ),
                              ],
                            ),
                            child: Icon(
                              Icons.search_rounded,
                              size: size * 0.16,
                              color: AppColors.main_background_blue,
                            ),
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      right: size * 0.08,
                      bottom: size * 0.18,
                      child: Transform.rotate(
                        angle: math.pi / 5 + wave * 0.3,
                        child: Container(
                          width: 4,
                          height: size * 0.16,
                          decoration: BoxDecoration(
                            color: AppColors.main_background_blue,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
