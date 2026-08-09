import 'package:cms/core/animations/app_page_route.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/entities/clinic.dart';
import 'package:cms/core/storage/saved_clinics_store.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/core/widgets/app_network_image.dart';
import 'package:cms/features/clinic/presentation/screens/clinic_detail_screen.dart';
import 'package:cms/injection_container.dart';
import 'package:flutter/material.dart';

enum ModernClinicCardStyle { carousel, list, compact }

/// Shared modern clinic card with curved corners, short titles, and light motion.
class ModernClinicCard extends StatefulWidget {
  const ModernClinicCard({
    super.key,
    required this.clinic,
    this.style = ModernClinicCardStyle.list,
    this.width,
    this.onTap,
    this.selected = false,
  });

  final Clinic clinic;
  final ModernClinicCardStyle style;
  final double? width;
  final VoidCallback? onTap;
  final bool selected;

  @override
  State<ModernClinicCard> createState() => _ModernClinicCardState();
}

class _ModernClinicCardState extends State<ModernClinicCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _press;
  late bool _saved;

  @override
  void initState() {
    super.initState();
    _press = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 120),
      lowerBound: 0.96,
      upperBound: 1,
      value: 1,
    );
    _saved = getIt<SavedClinicsStore>().isSaved(widget.clinic.id) ||
        widget.clinic.isSaved;
  }

  @override
  void didUpdateWidget(covariant ModernClinicCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.clinic.id != widget.clinic.id) {
      _saved = getIt<SavedClinicsStore>().isSaved(widget.clinic.id) ||
          widget.clinic.isSaved;
    }
  }

  @override
  void dispose() {
    _press.dispose();
    super.dispose();
  }

  Future<void> _toggleSaved() async {
    final next = await getIt<SavedClinicsStore>().toggle(widget.clinic);
    if (mounted) setState(() => _saved = next);
  }

  void _open() {
    if (widget.onTap != null) {
      widget.onTap!();
      return;
    }
    Navigator.push(
      context,
      AppPageRoute(builder: (_) => ClinicDetailScreen(clinic: widget.clinic)),
    );
  }

  BorderRadius get _radius {
    switch (widget.style) {
      case ModernClinicCardStyle.carousel:
        return const BorderRadius.only(
          topLeft: Radius.circular(28),
          topRight: Radius.circular(14),
          bottomLeft: Radius.circular(14),
          bottomRight: Radius.circular(28),
        );
      case ModernClinicCardStyle.compact:
        return const BorderRadius.only(
          topLeft: Radius.circular(22),
          topRight: Radius.circular(10),
          bottomLeft: Radius.circular(10),
          bottomRight: Radius.circular(22),
        );
      case ModernClinicCardStyle.list:
        return const BorderRadius.only(
          topLeft: Radius.circular(24),
          topRight: Radius.circular(12),
          bottomLeft: Radius.circular(12),
          bottomRight: Radius.circular(24),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isCompact = widget.style == ModernClinicCardStyle.compact;
    final isCarousel = widget.style == ModernClinicCardStyle.carousel;
    final imageHeight = isCompact ? 96.0 : (isCarousel ? 150.0 : 132.0);
    final cardWidth = widget.width ??
        (isCompact ? 168.0 : (isCarousel ? double.infinity : double.infinity));

    return GestureDetector(
      onTapDown: (_) => _press.reverse(),
      onTapUp: (_) {
        _press.forward();
        _open();
      },
      onTapCancel: () => _press.forward(),
      child: ScaleTransition(
        scale: _press,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          width: cardWidth == double.infinity ? null : cardWidth,
          margin: EdgeInsets.only(
            bottom: widget.style == ModernClinicCardStyle.list ? 12 : 0,
            right: isCompact || isCarousel ? 0 : 0,
          ),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: _radius,
            border: Border.all(
              color: widget.selected
                  ? AppColors.main_background_blue
                  : const Color(0xFFEEF1F6),
              width: widget.selected ? 1.6 : 1,
            ),
            boxShadow: [
              BoxShadow(
                color: (widget.selected
                        ? AppColors.main_background_blue
                        : Colors.black)
                    .withValues(alpha: widget.selected ? 0.18 : 0.06),
                blurRadius: widget.selected ? 18 : 12,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                height: imageHeight,
                width: double.infinity,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    AppNetworkImage(
                      imageUrl: widget.clinic.imageUrl,
                      fit: BoxFit.cover,
                    ),
                    DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            Colors.black.withValues(alpha: 0.45),
                          ],
                          stops: const [0.5, 1],
                        ),
                      ),
                    ),
                    Positioned(
                      top: 10,
                      right: 10,
                      child: _BookmarkButton(
                        saved: _saved,
                        onTap: _toggleSaved,
                      ),
                    ),
                    Positioned(
                      left: 10,
                      bottom: 10,
                      child: _MiniPill(
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              widget.clinic.rating.toStringAsFixed(1),
                              style: FontHeading.caption.copyWith(
                                fontWeight: FontWeight.w700,
                                color: Colors.black,
                              ),
                            ),
                            const SizedBox(width: 3),
                            Icon(
                              Icons.star_rounded,
                              size: 14,
                              color: Colors.amber.shade700,
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (widget.clinic.specialty.trim().isNotEmpty)
                      Positioned(
                        right: 10,
                        bottom: 10,
                        child: _MiniPill(
                          child: Text(
                            widget.clinic.specialty,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: FontHeading.caption.copyWith(
                              fontWeight: FontWeight.w600,
                              color: Colors.black87,
                              fontSize: 10,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Padding(
                padding: EdgeInsets.fromLTRB(
                  isCompact ? 10 : 14,
                  isCompact ? 8 : 11,
                  isCompact ? 10 : 14,
                  isCompact ? 10 : 12,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.clinic.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: FontHeading.body.copyWith(
                        fontSize: isCompact ? 14 : 16,
                        fontWeight: FontWeight.w700,
                        color: Colors.black,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(
                          Icons.location_on_outlined,
                          size: isCompact ? 13 : 15,
                          color: AppColors.CustomgrayDark,
                        ),
                        const SizedBox(width: 3),
                        Expanded(
                          child: Text(
                            widget.clinic.city.isNotEmpty
                                ? widget.clinic.city
                                : widget.clinic.location,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: FontHeading.caption.copyWith(
                              color: AppColors.CustomgrayDark,
                              fontSize: isCompact ? 11 : 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BookmarkButton extends StatelessWidget {
  const _BookmarkButton({required this.saved, required this.onTap});
  final bool saved;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.95),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            child: Icon(
              saved ? Icons.bookmark_rounded : Icons.bookmark_border_rounded,
              key: ValueKey(saved),
              size: 18,
              color: saved
                  ? AppColors.main_background_blue
                  : AppColors.CustomgrayDark,
            ),
          ),
        ),
      ),
    );
  }
}

class _MiniPill extends StatelessWidget {
  const _MiniPill({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 110),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(20),
      ),
      child: child,
    );
  }
}
