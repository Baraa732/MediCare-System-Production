import 'package:flutter/material.dart';

/// Keeps tab state after first visit, but avoids building off-screen tabs on startup.
///
/// [IndexedStack] builds every child immediately, which forced GoogleMap to
/// initialize on the home screen and crashed when no API key was configured.
class LazyIndexedStack extends StatefulWidget {
  const LazyIndexedStack({
    super.key,
    required this.index,
    required this.children,
  });

  final int index;
  final List<Widget> children;

  @override
  State<LazyIndexedStack> createState() => _LazyIndexedStackState();
}

class _LazyIndexedStackState extends State<LazyIndexedStack> {
  late Set<int> _loadedIndexes;

  @override
  void initState() {
    super.initState();
    _loadedIndexes = {widget.index.clamp(0, widget.children.length - 1)};
  }

  @override
  void didUpdateWidget(LazyIndexedStack oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.index != oldWidget.index) {
      _loadedIndexes = {..._loadedIndexes, widget.index};
    }
  }

  @override
  Widget build(BuildContext context) {
    return IndexedStack(
      index: widget.index,
      children: List.generate(widget.children.length, (i) {
        if (!_loadedIndexes.contains(i)) {
          return const SizedBox.shrink();
        }
        return widget.children[i];
      }),
    );
  }
}
