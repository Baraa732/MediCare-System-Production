import 'package:flutter/material.dart';

import '../models/appointment.dart';

enum ScheduleTimeBucket { morning, afternoon, evening }

enum ScheduleSortMode { timeAsc, timeDesc, nameAsc }

class AdvancedScheduleFilter {
  const AdvancedScheduleFilter({
    this.statuses = const {},
    this.timeBuckets = const {},
    this.sort = ScheduleSortMode.timeAsc,
    this.query = '',
  });

  /// UI statuses: 'Pending', 'Arrived', 'Completed'. Empty = all.
  final Set<String> statuses;
  final Set<ScheduleTimeBucket> timeBuckets;
  final ScheduleSortMode sort;
  final String query;

  static const empty = AdvancedScheduleFilter();

  bool get isActive =>
      statuses.isNotEmpty ||
      timeBuckets.isNotEmpty ||
      query.trim().isNotEmpty ||
      sort != ScheduleSortMode.timeAsc;

  int get activeCount {
    var n = 0;
    if (statuses.isNotEmpty) n++;
    if (timeBuckets.isNotEmpty) n++;
    if (query.trim().isNotEmpty) n++;
    if (sort != ScheduleSortMode.timeAsc) n++;
    return n;
  }

  AdvancedScheduleFilter copyWith({
    Set<String>? statuses,
    Set<ScheduleTimeBucket>? timeBuckets,
    ScheduleSortMode? sort,
    String? query,
  }) {
    return AdvancedScheduleFilter(
      statuses: statuses ?? this.statuses,
      timeBuckets: timeBuckets ?? this.timeBuckets,
      sort: sort ?? this.sort,
      query: query ?? this.query,
    );
  }

  List<Appointment> apply(List<Appointment> source) {
    var list = source.where((a) {
      if (query.trim().isNotEmpty) {
        final q = query.trim().toLowerCase();
        if (!a.patient.toLowerCase().contains(q) &&
            !a.tags.any((t) => t.toLowerCase().contains(q))) {
          return false;
        }
      }

      if (statuses.isNotEmpty) {
        final key = a.status ?? 'Pending';
        if (!statuses.contains(key)) return false;
      }

      if (timeBuckets.isNotEmpty) {
        final hour = a.scheduledAt.hour;
        final bucket = hour < 12
            ? ScheduleTimeBucket.morning
            : hour < 17
                ? ScheduleTimeBucket.afternoon
                : ScheduleTimeBucket.evening;
        if (!timeBuckets.contains(bucket)) return false;
      }

      return true;
    }).toList();

    switch (sort) {
      case ScheduleSortMode.timeAsc:
        list.sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));
      case ScheduleSortMode.timeDesc:
        list.sort((a, b) => b.scheduledAt.compareTo(a.scheduledAt));
      case ScheduleSortMode.nameAsc:
        list.sort(
          (a, b) => a.patient.toLowerCase().compareTo(b.patient.toLowerCase()),
        );
    }
    return list;
  }
}

Future<AdvancedScheduleFilter?> showAdvancedScheduleFilterSheet({
  required BuildContext context,
  required AdvancedScheduleFilter initial,
  required Map<String, int> statusCounts,
}) {
  return showModalBottomSheet<AdvancedScheduleFilter>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => _AdvancedFilterSheet(
      initial: initial,
      statusCounts: statusCounts,
    ),
  );
}

class _AdvancedFilterSheet extends StatefulWidget {
  const _AdvancedFilterSheet({
    required this.initial,
    required this.statusCounts,
  });

  final AdvancedScheduleFilter initial;
  final Map<String, int> statusCounts;

  @override
  State<_AdvancedFilterSheet> createState() => _AdvancedFilterSheetState();
}

class _AdvancedFilterSheetState extends State<_AdvancedFilterSheet> {
  late Set<String> _statuses;
  late Set<ScheduleTimeBucket> _buckets;
  late ScheduleSortMode _sort;
  late final TextEditingController _queryCtrl;

  @override
  void initState() {
    super.initState();
    _statuses = {...widget.initial.statuses};
    _buckets = {...widget.initial.timeBuckets};
    _sort = widget.initial.sort;
    _queryCtrl = TextEditingController(text: widget.initial.query);
  }

  @override
  void dispose() {
    _queryCtrl.dispose();
    super.dispose();
  }

  void _toggleStatus(String s) {
    setState(() {
      if (_statuses.contains(s)) {
        _statuses.remove(s);
      } else {
        _statuses.add(s);
      }
    });
  }

  void _toggleBucket(ScheduleTimeBucket b) {
    setState(() {
      if (_buckets.contains(b)) {
        _buckets.remove(b);
      } else {
        _buckets.add(b);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.88,
        ),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 10),
              Container(
                width: 42,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFDBDBDC),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 12, 8),
                child: Row(
                  children: [
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Smart filters',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF1A1B1E),
                              letterSpacing: -0.3,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Refine your board like a pro',
                            style: TextStyle(
                              fontSize: 13,
                              color: Color(0xFF929296),
                            ),
                          ),
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        setState(() {
                          _statuses.clear();
                          _buckets.clear();
                          _sort = ScheduleSortMode.timeAsc;
                          _queryCtrl.clear();
                        });
                      },
                      child: const Text('Reset'),
                    ),
                  ],
                ),
              ),
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextField(
                        controller: _queryCtrl,
                        onChanged: (_) => setState(() {}),
                        decoration: InputDecoration(
                          hintText: 'Search patient or visit reason',
                          prefixIcon: const Icon(
                            Icons.search_rounded,
                            color: Color(0xFF0B74FA),
                          ),
                          filled: true,
                          fillColor: const Color(0xFFF2F2F2),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: BorderSide.none,
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      _sectionTitle('Status'),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _statusChip('Pending', Icons.hourglass_top_rounded),
                          _statusChip('Arrived', Icons.login_rounded),
                          _statusChip('Completed', Icons.check_circle_outline),
                        ],
                      ),
                      const SizedBox(height: 18),
                      _sectionTitle('Time of day'),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: _bucketCard(
                              ScheduleTimeBucket.morning,
                              'Morning',
                              'Before 12',
                              Icons.wb_sunny_outlined,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _bucketCard(
                              ScheduleTimeBucket.afternoon,
                              'Afternoon',
                              '12 – 5',
                              Icons.wb_twilight_outlined,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _bucketCard(
                              ScheduleTimeBucket.evening,
                              'Evening',
                              'After 5',
                              Icons.nights_stay_outlined,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      _sectionTitle('Sort by'),
                      const SizedBox(height: 10),
                      _sortTile(
                        ScheduleSortMode.timeAsc,
                        'Earliest first',
                        Icons.arrow_upward_rounded,
                      ),
                      _sortTile(
                        ScheduleSortMode.timeDesc,
                        'Latest first',
                        Icons.arrow_downward_rounded,
                      ),
                      _sortTile(
                        ScheduleSortMode.nameAsc,
                        'Patient name A–Z',
                        Icons.sort_by_alpha_rounded,
                      ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                child: SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.pop(
                        context,
                        AdvancedScheduleFilter(
                          statuses: _statuses,
                          timeBuckets: _buckets,
                          sort: _sort,
                          query: _queryCtrl.text.trim(),
                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0B74FA),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: const Text(
                      'Apply filters',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sectionTitle(String text) => Text(
        text,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.4,
          color: Color(0xFF929296),
        ),
      );

  Widget _statusChip(String label, IconData icon) {
    final selected = _statuses.contains(label);
    final count = widget.statusCounts[label] ?? 0;
    return GestureDetector(
      onTap: () => _toggleStatus(label),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFEEF4FF) : const Color(0xFFF2F2F2),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? const Color(0xFF0B74FA) : const Color(0xFFDBDBDC),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 16,
              color: selected
                  ? const Color(0xFF0B74FA)
                  : const Color(0xFF929296),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: selected
                    ? const Color(0xFF0B74FA)
                    : const Color(0xFF1A1B1E),
              ),
            ),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '$count',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF929296),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _bucketCard(
    ScheduleTimeBucket bucket,
    String title,
    String caption,
    IconData icon,
  ) {
    final selected = _buckets.contains(bucket);
    return GestureDetector(
      onTap: () => _toggleBucket(bucket),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.fromLTRB(10, 12, 10, 12),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFEEF4FF) : const Color(0xFFF2F2F2),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? const Color(0xFF0B74FA) : const Color(0xFFDBDBDC),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: selected
                  ? const Color(0xFF0B74FA)
                  : const Color(0xFF929296),
            ),
            const SizedBox(height: 6),
            Text(
              title,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w800,
                color: selected
                    ? const Color(0xFF0B74FA)
                    : const Color(0xFF1A1B1E),
              ),
            ),
            Text(
              caption,
              style: const TextStyle(fontSize: 10.5, color: Color(0xFF929296)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sortTile(ScheduleSortMode mode, String label, IconData icon) {
    final selected = _sort == mode;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: selected ? const Color(0xFFEEF4FF) : const Color(0xFFF2F2F2),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => setState(() => _sort = mode),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 18,
                  color: selected
                      ? const Color(0xFF0B74FA)
                      : const Color(0xFF929296),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: selected
                          ? const Color(0xFF0B74FA)
                          : const Color(0xFF1A1B1E),
                    ),
                  ),
                ),
                if (selected)
                  const Icon(Icons.check_circle, color: Color(0xFF0B74FA), size: 18),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
