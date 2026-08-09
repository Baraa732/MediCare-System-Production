import 'package:cms/core/entities/clinic.dart';
import 'package:cms/core/widgets/modern_clinic_card.dart';
import 'package:cms/core/widgets/page_indicator.dart';
import 'package:flutter/material.dart';

/// Left/right peek carousel for clinics (swipeable cards).
class ClinicPeekCarousel extends StatefulWidget {
  const ClinicPeekCarousel({super.key, required this.clinics});

  final List<Clinic> clinics;

  @override
  State<ClinicPeekCarousel> createState() => _ClinicPeekCarouselState();
}

class _ClinicPeekCarouselState extends State<ClinicPeekCarousel> {
  late final PageController _controller;
  double _page = 0;

  @override
  void initState() {
    super.initState();
    _controller = PageController(viewportFraction: 0.78);
    _controller.addListener(() {
      final page = _controller.page ?? 0;
      if ((page - _page).abs() > 0.01) {
        setState(() => _page = page);
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.clinics.isEmpty) return const SizedBox.shrink();

    return Column(
      children: [
        SizedBox(
          height: 248,
          child: PageView.builder(
            controller: _controller,
            itemCount: widget.clinics.length,
            padEnds: true,
            physics: const BouncingScrollPhysics(),
            itemBuilder: (context, index) {
              final clinic = widget.clinics[index];
              final delta = (_page - index).abs().clamp(0.0, 1.0);
              final scale = 1 - (delta * 0.07);
              final opacity = 1 - (delta * 0.25);

              return Transform.scale(
                scale: scale,
                child: Opacity(
                  opacity: opacity,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                    child: ModernClinicCard(
                      clinic: clinic,
                      style: ModernClinicCardStyle.carousel,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        if (widget.clinics.length > 1 && widget.clinics.length <= 10) ...[
          const SizedBox(height: 8),
          PageIndicator(
            currentPage: _page.round().clamp(0, widget.clinics.length - 1),
            totalPages: widget.clinics.length,
            dotSize: 7,
            selectedDotSize: 9,
          ),
        ],
      ],
    );
  }
}
