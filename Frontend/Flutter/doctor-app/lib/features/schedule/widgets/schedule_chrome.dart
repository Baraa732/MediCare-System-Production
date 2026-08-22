import 'package:cms_doctor_app/core/constants/app_assets.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

import '../../../core/layout/app_shell.dart';
import '../../../core/navigation/app_navigation.dart';
import 'schedule_filter.dart';

/// Soft fade + slide entrance used across schedule pages.
class FadeSlideIn extends StatelessWidget {
  const FadeSlideIn({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.offset = const Offset(0, 0.08),
    this.duration = const Duration(milliseconds: 380),
  });

  final Widget child;
  final Duration delay;
  final Offset offset;
  final Duration duration;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<void>(
      future: Future<void>.delayed(delay),
      builder: (context, snapshot) {
        final ready = snapshot.connectionState == ConnectionState.done;
        return AnimatedOpacity(
          opacity: ready ? 1 : 0,
          duration: duration,
          curve: Curves.easeOutCubic,
          child: AnimatedSlide(
            offset: ready ? Offset.zero : offset,
            duration: duration,
            curve: Curves.easeOutCubic,
            child: child,
          ),
        );
      },
    );
  }
}

class ScheduleMetric {
  const ScheduleMetric({
    required this.label,
    required this.value,
    required this.progress,
    required this.icon,
    this.accent = const Color(0xFF0B74FA),
  });

  final String label;
  final String value;
  final double progress;
  final IconData icon;
  final Color accent;
}

/// Advanced command-center header with Lottie and floating board (no phone clock).
class AdvancedScheduleHeader extends StatefulWidget {
  const AdvancedScheduleHeader({
    super.key,
    required this.activeTab,
    required this.parentContext,
    required this.boardTitle,
    required this.boardCaption,
    required this.metrics,
    this.onNotificationTap,
    this.trailingActions,
  });

  final int activeTab;
  final BuildContext parentContext;
  final String boardTitle;
  final String boardCaption;
  final List<ScheduleMetric> metrics;
  final VoidCallback? onNotificationTap;
  final Widget? trailingActions;

  @override
  State<AdvancedScheduleHeader> createState() => _AdvancedScheduleHeaderState();
}

class _AdvancedScheduleHeaderState extends State<AdvancedScheduleHeader>
    with TickerProviderStateMixin {
  late final AnimationController _pulse;
  late final AnimationController _shimmer;
  String _doctorName = sessionStorage.displayName;

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
    _hydrateName();
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
    _pulse.dispose();
    _shimmer.dispose();
    super.dispose();
  }

  String get _greeting {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return Column(
      children: [
        Container(
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
                top: -20,
                child: AnimatedBuilder(
                  animation: _shimmer,
                  builder: (_, __) => Transform.rotate(
                    angle: _shimmer.value * 0.4,
                    child: Container(
                      width: 180,
                      height: 180,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withValues(alpha: 0.08),
                      ),
                    ),
                  ),
                ),
              ),
              Positioned(
                left: -30,
                bottom: 10,
                child: Container(
                  width: 110,
                  height: 110,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withValues(alpha: 0.06),
                  ),
                ),
              ),
              Padding(
                padding: EdgeInsets.fromLTRB(16, top + 8, 16, 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        _liveChip(),
                        const Spacer(),
                        notificationButton(onTap: widget.onNotificationTap),
                      ],
                    ),
                    const SizedBox(height: 18),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _greeting,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white.withValues(alpha: 0.85),
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'Dr. $_doctorName',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                  letterSpacing: -0.5,
                                  height: 1.15,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                widget.boardCaption,
                                style: TextStyle(
                                  fontSize: 13.5,
                                  height: 1.35,
                                  color: Colors.white.withValues(alpha: 0.88),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        AnimatedBuilder(
                          animation: _pulse,
                          builder: (_, child) => Transform.translate(
                            offset: Offset(0, -3 * _pulse.value),
                            child: child,
                          ),
                          child: SizedBox(
                            width: 96,
                            height: 96,
                            child: Lottie.asset(
                              AppAssets.lottieDoctor,
                              fit: BoxFit.contain,
                              errorBuilder: (_, __, ___) =>
                                  const SizedBox.shrink(),
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
        Transform.translate(
          offset: const Offset(0, -18),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: FadeSlideIn(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF0B74FA).withValues(alpha: 0.14),
                      blurRadius: 24,
                      offset: const Offset(0, 12),
                    ),
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    ScheduleViewTabs(
                      activeTab: widget.activeTab,
                      parentContext: widget.parentContext,
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        for (var i = 0; i < widget.metrics.length; i++) ...[
                          if (i > 0) const SizedBox(width: 8),
                          Expanded(child: _MetricOrb(metric: widget.metrics[i])),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        if (widget.trailingActions != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
            child: widget.trailingActions!,
          ),
      ],
    );
  }

  Widget _liveChip() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedBuilder(
            animation: _pulse,
            builder: (_, __) => Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Color.lerp(
                  const Color(0xFFB8F0C8),
                  Colors.white,
                  _pulse.value,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFB8F0C8).withValues(alpha: 0.7),
                    blurRadius: 6 * _pulse.value,
                  ),
                ],
              ),
            ),
          ),
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
      ),
    );
  }

}

class _MetricOrb extends StatelessWidget {
  const _MetricOrb({required this.metric});

  final ScheduleMetric metric;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 10, 10, 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF2F2F2),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          SizedBox(
            width: 42,
            height: 42,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 42,
                  height: 42,
                  child: CircularProgressIndicator(
                    value: metric.progress.clamp(0.0, 1.0),
                    strokeWidth: 3.5,
                    backgroundColor: metric.accent.withValues(alpha: 0.15),
                    valueColor: AlwaysStoppedAnimation(metric.accent),
                    strokeCap: StrokeCap.round,
                  ),
                ),
                Icon(metric.icon, size: 16, color: metric.accent),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            metric.value,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: Color(0xFF1A1B1E),
            ),
          ),
          Text(
            metric.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11, color: Color(0xFF929296)),
          ),
        ],
      ),
    );
  }
}

class ScheduleViewTabs extends StatelessWidget {
  const ScheduleViewTabs({
    super.key,
    required this.activeTab,
    required this.parentContext,
  });

  final int activeTab;
  final BuildContext parentContext;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: const Color(0xFFF2F2F2),
        borderRadius: BorderRadius.circular(44),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final tabWidth = constraints.maxWidth / 3;
          return Stack(
            children: [
              AnimatedPositioned(
                duration: const Duration(milliseconds: 280),
                curve: Curves.easeOutCubic,
                left: activeTab * tabWidth,
                top: 0,
                bottom: 0,
                width: tabWidth,
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(40),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF0B74FA).withValues(alpha: 0.12),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                ),
              ),
              Row(
                children: [
                  _tab('Day', 0, Icons.view_day_outlined),
                  _tab('Week', 1, Icons.view_week_outlined),
                  _tab('Month', 2, Icons.calendar_month_outlined),
                ],
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _tab(String label, int index, IconData icon) {
    final active = index == activeTab;
    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => switchScheduleTab(parentContext, activeTab, index),
        child: SizedBox(
          height: 38,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedScale(
                scale: active ? 1.05 : 1,
                duration: const Duration(milliseconds: 220),
                child: Icon(
                  icon,
                  size: 15,
                  color: active
                      ? const Color(0xFF0B74FA)
                      : const Color(0xFF929296),
                ),
              ),
              const SizedBox(width: 5),
              AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 220),
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w400,
                  color: active
                      ? const Color(0xFF1A1B1E)
                      : const Color(0xFF929296),
                ),
                child: Text(label),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ScheduleCommandBar extends StatelessWidget {
  const ScheduleCommandBar({
    super.key,
    required this.title,
    required this.subtitle,
    required this.onPrev,
    required this.onNext,
    required this.onCenter,
    required this.centerLabel,
    required this.centerActive,
    required this.filter,
    required this.onOpenFilter,
    required this.onClearFilter,
  });

  final String title;
  final String subtitle;
  final VoidCallback onPrev;
  final VoidCallback onNext;
  final VoidCallback onCenter;
  final String centerLabel;
  final bool centerActive;
  final AdvancedScheduleFilter filter;
  final VoidCallback onOpenFilter;
  final VoidCallback onClearFilter;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEEF4FF),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(
                      Icons.calendar_month_rounded,
                      color: Color(0xFF0B74FA),
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF1A1B1E),
                            letterSpacing: -0.2,
                          ),
                        ),
                        Text(
                          subtitle,
                          style: const TextStyle(
                            fontSize: 12.5,
                            color: Color(0xFF929296),
                          ),
                        ),
                      ],
                    ),
                  ),
                  _filterButton(),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  _navBtn(Icons.chevron_left_rounded, onPrev),
                  Expanded(
                    child: GestureDetector(
                      onTap: onCenter,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        height: 42,
                        margin: const EdgeInsets.symmetric(horizontal: 8),
                        decoration: BoxDecoration(
                          color: centerActive
                              ? const Color(0xFFEEF4FF)
                              : const Color(0xFFF2F2F2),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: centerActive
                                ? const Color(0xFF0B74FA)
                                : const Color(0xFFDBDBDC),
                          ),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          centerLabel,
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: centerActive
                                ? const Color(0xFF0B74FA)
                                : const Color(0xFF1A1B1E),
                          ),
                        ),
                      ),
                    ),
                  ),
                  _navBtn(Icons.chevron_right_rounded, onNext),
                ],
              ),
            ],
          ),
        ),
        if (filter.isActive) ...[
          const SizedBox(height: 10),
          SizedBox(
            height: 36,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _chip(
                  'Filters · ${filter.activeCount}',
                  onTap: onOpenFilter,
                  selected: true,
                ),
                if (filter.query.isNotEmpty)
                  _chip('“${filter.query}”', onTap: onOpenFilter),
                ...filter.statuses.map((s) => _chip(s, onTap: onOpenFilter)),
                if (filter.timeBuckets.contains(ScheduleTimeBucket.morning))
                  _chip('Morning', onTap: onOpenFilter),
                if (filter.timeBuckets.contains(ScheduleTimeBucket.afternoon))
                  _chip('Afternoon', onTap: onOpenFilter),
                if (filter.timeBuckets.contains(ScheduleTimeBucket.evening))
                  _chip('Evening', onTap: onOpenFilter),
                _chip('Clear all', onTap: onClearFilter, danger: true),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _filterButton() {
    return Material(
      color: filter.isActive ? const Color(0xFF0B74FA) : const Color(0xFFEEF4FF),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onOpenFilter,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Icon(
                Icons.tune_rounded,
                size: 16,
                color: filter.isActive ? Colors.white : const Color(0xFF0B74FA),
              ),
              const SizedBox(width: 6),
              Text(
                filter.isActive ? 'Filtered' : 'Filter',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                  color: filter.isActive ? Colors.white : const Color(0xFF0B74FA),
                ),
              ),
              if (filter.isActive) ...[
                const SizedBox(width: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '${filter.activeCount}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _navBtn(IconData icon, VoidCallback onTap) => Material(
        color: const Color(0xFF0B74FA),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: SizedBox(
            width: 42,
            height: 42,
            child: Icon(icon, color: Colors.white),
          ),
        ),
      );

  Widget _chip(
    String label, {
    required VoidCallback onTap,
    bool selected = false,
    bool danger = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: danger
                ? const Color(0xFFFFEBEE)
                : selected
                    ? const Color(0xFFEEF4FF)
                    : Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: danger
                  ? const Color(0xFFFFCDD2)
                  : const Color(0xFFDBDBDC),
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: danger
                  ? const Color(0xFFC62828)
                  : selected
                      ? const Color(0xFF0B74FA)
                      : const Color(0xFF1A1B1E),
            ),
          ),
        ),
      ),
    );
  }
}

class ScheduleSoftCard extends StatelessWidget {
  const ScheduleSoftCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(14),
    this.margin = EdgeInsets.zero,
  });

  final Widget child;
  final EdgeInsets padding;
  final EdgeInsets margin;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: child,
    );
  }
}

class ScheduleEmptyState extends StatelessWidget {
  const ScheduleEmptyState({
    super.key,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
    this.error,
  });

  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (error != null)
              Text(
                error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.red, fontSize: 14),
              )
            else ...[
              SizedBox(
                width: 150,
                height: 150,
                child: Lottie.asset(
                  AppAssets.lottieEmptyCalendar,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => Image.asset(
                    AppAssets.noDayAppointments,
                    width: 100,
                    height: 100,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF1A1B1E),
                ),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 6),
                Text(
                  subtitle!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Color(0xFF929296),
                    height: 1.4,
                  ),
                ),
              ],
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 14),
              TextButton(
                onPressed: onAction,
                style: TextButton.styleFrom(
                  foregroundColor: const Color(0xFF0B74FA),
                ),
                child: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class AnimatedAppointmentTile extends StatelessWidget {
  const AnimatedAppointmentTile({
    super.key,
    required this.index,
    required this.child,
  });

  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return FadeSlideIn(
      delay: Duration(milliseconds: 40 * (index.clamp(0, 10))),
      child: child,
    );
  }
}

/// Backward-compatible alias used by older call sites.
@Deprecated('Use AdvancedScheduleHeader')
class ScheduleHeroHeader extends StatelessWidget {
  const ScheduleHeroHeader({
    super.key,
    required this.subtitle,
    this.greeting,
    this.onNotificationTap,
  });

  final String subtitle;
  final String? greeting;
  final VoidCallback? onNotificationTap;

  @override
  Widget build(BuildContext context) {
    return AdvancedScheduleHeader(
      activeTab: 0,
      parentContext: context,
      boardTitle: greeting ?? 'Schedule',
      boardCaption: subtitle,
      metrics: const [
        ScheduleMetric(
          label: 'Board',
          value: '—',
          progress: 0,
          icon: Icons.dashboard_outlined,
        ),
      ],
      onNotificationTap: onNotificationTap,
    );
  }
}
