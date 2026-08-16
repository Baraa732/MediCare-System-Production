import 'dart:math' as math;
import 'dart:ui';

import 'package:cms_doctor_app/core/constants/app_assets.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:lottie/lottie.dart';

import '../../../core/layout/app_shell.dart';
import 'schedule_chrome.dart';

/// Schedule shell with soft board overlap onto the blue hero.
///
/// Overlap only covers sacrificial blue padding — doctor name + Lottie
/// stay fully visible. Scroll collapse is ticker-smoothed.
class ScheduleWorkspace extends StatefulWidget {
  const ScheduleWorkspace({
    super.key,
    required this.activeTab,
    required this.boardCaption,
    required this.metrics,
    required this.slivers,
    this.onNotificationTap,
    this.onRefresh,
  });

  final int activeTab;
  final String boardCaption;
  final List<ScheduleMetric> metrics;
  final List<Widget> slivers;
  final VoidCallback? onNotificationTap;
  final Future<void> Function()? onRefresh;

  @override
  State<ScheduleWorkspace> createState() => _ScheduleWorkspaceState();
}

class _ScheduleWorkspaceState extends State<ScheduleWorkspace>
    with TickerProviderStateMixin {
  static const _collapseRange = 160.0;
  static const _baseOverlap = 22.0;

  late final AnimationController _pulse;
  late final AnimationController _shimmer;
  late final Ticker _smoothTicker;
  final ScrollController _scroll = ScrollController();
  String _doctorName = sessionStorage.displayName;
  double _collapseTarget = 0;
  double _collapse = 0;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat(reverse: true);
    _shimmer = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat();
    _smoothTicker = createTicker(_onTick)..start();
    _scroll.addListener(_onScroll);
    _hydrateName();
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    _collapseTarget = (_scroll.offset / _collapseRange).clamp(0.0, 1.0);
  }

  void _onTick(Duration _) {
    final next = uiLerp(_collapse, _collapseTarget, 0.16);
    if ((next - _collapse).abs() < 0.0008) {
      if (_collapse != _collapseTarget) {
        setState(() => _collapse = _collapseTarget);
      }
      return;
    }
    setState(() => _collapse = next);
  }

  Future<void> _hydrateName() async {
    try {
      await authApi.refreshProfileNames();
    } catch (_) {}
    if (!mounted) return;
    setState(() => _doctorName = sessionStorage.displayName);
  }

  @override
  void dispose() {
    _smoothTicker.dispose();
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    _pulse.dispose();
    _shimmer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    final t = Curves.easeOutCubic.transform(_collapse);
    // Overlap grows slightly as the board widens — still only into blue pad.
    final overlap = lerpDouble(_baseOverlap, 14, t)!;

    final scrollView = CustomScrollView(
      controller: _scroll,
      physics: const BouncingScrollPhysics(
        parent: AlwaysScrollableScrollPhysics(),
      ),
      slivers: [
        ...widget.slivers,
        const SpiverBottomPad(),
      ],
    );

    return ColoredBox(
      color: const Color(0xFFF2F2F2),
      child: Column(
        children: [
          _HeroHeader(
            topInset: top,
            collapse: t,
            doctorName: _doctorName,
            caption: widget.boardCaption,
            pulse: _pulse,
            shimmer: _shimmer,
            overlapPad: overlap,
            onNotificationTap: widget.onNotificationTap,
          ),
          Transform.translate(
            offset: Offset(0, -overlap),
            child: _BoardPanel(
              collapse: t,
              activeTab: widget.activeTab,
              parentContext: context,
              metrics: widget.metrics,
            ),
          ),
          Expanded(
            child: Transform.translate(
              offset: Offset(0, -overlap),
              child: widget.onRefresh == null
                  ? scrollView
                  : RefreshIndicator(
                      color: const Color(0xFF0B74FA),
                      onRefresh: widget.onRefresh!,
                      child: scrollView,
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

double uiLerp(double a, double b, double t) => a + (b - a) * t;

class SpiverBottomPad extends StatelessWidget {
  const SpiverBottomPad({super.key});

  @override
  Widget build(BuildContext context) {
    return const SliverToBoxAdapter(child: SizedBox(height: 48));
  }
}

class _HeroHeader extends StatelessWidget {
  const _HeroHeader({
    required this.topInset,
    required this.collapse,
    required this.doctorName,
    required this.caption,
    required this.pulse,
    required this.shimmer,
    required this.overlapPad,
    this.onNotificationTap,
  });

  final double topInset;
  final double collapse;
  final String doctorName;
  final String caption;
  final AnimationController pulse;
  final AnimationController shimmer;
  final double overlapPad;
  final VoidCallback? onNotificationTap;

  String get _greeting {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final compact = collapse > 0.78;
    // Keep name/lottie readable — never fade them out under the board.
    final detailOpacity = (1 - collapse * 0.85).clamp(0.35, 1.0);
    final lottieSize = lerpDouble(96, 52, collapse)!;
    final nameSize = lerpDouble(24, 18, collapse)!;
    final bodyHeight = lerpDouble(138, 88, collapse)!;
    final heroPadBottom = overlapPad + lerpDouble(10, 6, collapse)!;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF0B74FA),
              Color(0xFF0B74FA),
              Color(0xFF0A66DE),
            ],
          ),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned(
              right: -40,
              top: -24,
              child: AnimatedBuilder(
                animation: shimmer,
                builder: (_, __) => Transform.rotate(
                  angle: shimmer.value * 0.35,
                  child: Container(
                    width: 170,
                    height: 170,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: 0.08),
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(16, topInset + 8, 16, heroPadBottom),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      _LiveChip(pulse: pulse, compact: compact),
                      const Spacer(),
                      if (compact)
                        Flexible(
                          child: Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: Text(
                              'Dr. $doctorName',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.right,
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                fontSize: 14,
                              ),
                            ),
                          ),
                        ),
                      notificationButton(onTap: onNotificationTap),
                    ],
                  ),
                  SizedBox(
                    height: bodyHeight,
                    child: Opacity(
                      opacity: detailOpacity,
                      child: Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    _greeting,
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.white
                                          .withValues(alpha: 0.88),
                                    ),
                                  ),
                                  const SizedBox(height: 5),
                                  Text(
                                    'Dr. $doctorName',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: nameSize,
                                      fontWeight: FontWeight.w800,
                                      color: Colors.white,
                                      letterSpacing: -0.4,
                                      height: 1.15,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    caption,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 13.5,
                                      height: 1.3,
                                      color: Colors.white
                                          .withValues(alpha: 0.88),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            AnimatedBuilder(
                              animation: pulse,
                              builder: (_, child) => Transform.translate(
                                offset: Offset(
                                  0,
                                  -2.5 * pulse.value * (1 - collapse * 0.6),
                                ),
                                child: child,
                              ),
                              child: SizedBox(
                                width: lottieSize,
                                height: lottieSize,
                                child: Lottie.asset(
                                  AppAssets.lottieDoctorWave,
                                  fit: BoxFit.contain,
                                  errorBuilder: (_, __, ___) =>
                                      const SizedBox.shrink(),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BoardPanel extends StatelessWidget {
  const _BoardPanel({
    required this.collapse,
    required this.activeTab,
    required this.parentContext,
    required this.metrics,
  });

  final double collapse;
  final int activeTab;
  final BuildContext parentContext;
  final List<ScheduleMetric> metrics;

  @override
  Widget build(BuildContext context) {
    final inset = lerpDouble(14, 0, collapse)!;
    final radius = lerpDouble(22, 0, collapse)!;

    return Padding(
      padding: EdgeInsets.fromLTRB(inset, 0, inset, 0),
      child: Container(
        width: double.infinity,
        padding: EdgeInsets.fromLTRB(
          lerpDouble(12, 16, collapse)!,
          12,
          lerpDouble(12, 16, collapse)!,
          12,
        ),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(radius <= 1 ? 18 : radius),
            bottom: Radius.circular(radius <= 1 ? 0 : radius),
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0B74FA).withValues(
                alpha: lerpDouble(0.14, 0.05, collapse)!,
              ),
              blurRadius: lerpDouble(24, 10, collapse)!,
              offset: Offset(0, lerpDouble(12, 4, collapse)!),
            ),
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ScheduleViewTabs(
              activeTab: activeTab,
              parentContext: parentContext,
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                for (var i = 0; i < metrics.length; i++) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(
                    child: _MetricOrb(
                      metric: metrics[i],
                      compact: collapse > 0.5,
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _LiveChip extends StatelessWidget {
  const _LiveChip({required this.pulse, required this.compact});

  final AnimationController pulse;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 10,
        vertical: compact ? 5 : 6,
      ),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedBuilder(
            animation: pulse,
            builder: (_, __) => Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Color.lerp(
                  const Color(0xFFB8F0C8),
                  Colors.white,
                  pulse.value,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFB8F0C8).withValues(alpha: 0.7),
                    blurRadius: 6 * pulse.value,
                  ),
                ],
              ),
            ),
          ),
          if (!compact) ...[
            const SizedBox(width: 6),
            const Text(
              'Live board',
              style: TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _MetricOrb extends StatelessWidget {
  const _MetricOrb({required this.metric, required this.compact});

  final ScheduleMetric metric;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final ring = compact ? 34.0 : 42.0;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
      padding: EdgeInsets.fromLTRB(
        compact ? 8 : 10,
        compact ? 8 : 10,
        compact ? 8 : 10,
        compact ? 8 : 10,
      ),
      decoration: BoxDecoration(
        color: const Color(0xFFF2F2F2),
        borderRadius: BorderRadius.circular(compact ? 14 : 16),
      ),
      child: Column(
        children: [
          SizedBox(
            width: ring,
            height: ring,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: ring,
                  height: ring,
                  child: CircularProgressIndicator(
                    value: metric.progress.clamp(0.0, 1.0),
                    strokeWidth: 3.2,
                    backgroundColor: metric.accent.withValues(alpha: 0.12),
                    color: metric.accent,
                  ),
                ),
                Icon(metric.icon, size: compact ? 14 : 16, color: metric.accent),
              ],
            ),
          ),
          SizedBox(height: compact ? 6 : 8),
          Text(
            metric.value,
            style: TextStyle(
              fontSize: compact ? 13 : 15,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF1A1B1E),
            ),
          ),
          Text(
            metric.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: compact ? 10 : 11,
              color: const Color(0xFF929296),
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

/// Soft content panel used by day/week/month boards.
class ExpandingPanel extends StatelessWidget {
  const ExpandingPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.fromLTRB(16, 8, 16, 0),
  });

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Padding(padding: padding, child: child);
  }
}

/// Horizontal tall date pills.
class PremiumDateStrip extends StatelessWidget {
  const PremiumDateStrip({
    super.key,
    required this.days,
    required this.selected,
    required this.onSelect,
    this.counts = const {},
  });

  final List<DateTime> days;
  final DateTime selected;
  final ValueChanged<DateTime> onSelect;
  final Map<int, int> counts;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 96,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 4),
        itemCount: days.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, i) {
          final day = days[i];
          final selectedDay = DateUtils.isSameDay(day, selected);
          final count = counts[day.day] ?? 0;
          return GestureDetector(
            onTap: () {
              HapticFeedback.selectionClick();
              onSelect(day);
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 260),
              curve: Curves.easeOutCubic,
              width: 56,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(22),
                gradient: selectedDay
                    ? const LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Color(0xFF0B74FA), Color(0xFF0A66DE)],
                      )
                    : null,
                color: selectedDay ? null : const Color(0xFFF2F2F2),
                boxShadow: selectedDay
                    ? [
                        BoxShadow(
                          color: const Color(0xFF0B74FA).withValues(alpha: 0.28),
                          blurRadius: 16,
                          offset: const Offset(0, 8),
                        ),
                      ]
                    : null,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    _weekday(day),
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: selectedDay
                          ? Colors.white.withValues(alpha: 0.9)
                          : const Color(0xFF929296),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${day.day}',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: selectedDay
                          ? Colors.white
                          : const Color(0xFF1A1B1E),
                    ),
                  ),
                  const SizedBox(height: 6),
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    width: count > 0 ? 18 : 6,
                    height: 6,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(6),
                      color: selectedDay
                          ? Colors.white.withValues(alpha: 0.85)
                          : count > 0
                              ? const Color(0xFF0B74FA)
                              : const Color(0xFFDBDBDC),
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

  String _weekday(DateTime d) {
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return labels[d.weekday % 7];
  }
}

/// Circular day radar — appointments around a live clock ring.
class DayOrbitRing extends StatelessWidget {
  const DayOrbitRing({
    super.key,
    required this.appointments,
    required this.selectedIndex,
    required this.onSelect,
  });

  final List<({String label, String time, Color color, bool done})> appointments;
  final int selectedIndex;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final now = TimeOfDay.now();
    final label =
        '${now.hourOfPeriod == 0 ? 12 : now.hourOfPeriod}:${now.minute.toString().padLeft(2, '0')} ${now.period == DayPeriod.am ? 'am' : 'pm'}';

    return SizedBox(
      height: 220,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final size = math.min(constraints.maxWidth, 220.0);
          return Center(
            child: SizedBox(
              width: size,
              height: size,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: size,
                    height: size,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: [
                          const Color(0xFF0B74FA).withValues(alpha: 0.12),
                          const Color(0xFFEEF4FF),
                          Colors.white,
                        ],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color:
                              const Color(0xFF0B74FA).withValues(alpha: 0.12),
                          blurRadius: 24,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    width: size * 0.58,
                    height: size * 0.58,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Color(0xFF0B74FA), Color(0xFF0A66DE)],
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          label,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.5,
                          ),
                        ),
                        Text(
                          '${appointments.length} visits',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.85),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (appointments.isNotEmpty)
                    ...List.generate(appointments.length, (i) {
                      final angle =
                          -math.pi / 2 + (2 * math.pi * i / appointments.length);
                      final r = size * 0.38;
                      final x = math.cos(angle) * r;
                      final y = math.sin(angle) * r;
                      final selected = i == selectedIndex;
                      final a = appointments[i];
                      return Transform.translate(
                        offset: Offset(x, y),
                        child: GestureDetector(
                          onTap: () {
                            HapticFeedback.lightImpact();
                            onSelect(i);
                          },
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 240),
                            width: selected ? 44 : 36,
                            height: selected ? 44 : 36,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: a.done
                                  ? const Color(0xFFEAF7EE)
                                  : Colors.white,
                              border: Border.all(
                                color: selected
                                    ? a.color
                                    : a.color.withValues(alpha: 0.35),
                                width: selected ? 3 : 1.5,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: a.color.withValues(
                                    alpha: selected ? 0.35 : 0.12,
                                  ),
                                  blurRadius: selected ? 12 : 6,
                                ),
                              ],
                            ),
                            child: Icon(
                              a.done
                                  ? Icons.check_rounded
                                  : Icons.medical_services_outlined,
                              size: selected ? 18 : 15,
                              color: a.color,
                            ),
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
