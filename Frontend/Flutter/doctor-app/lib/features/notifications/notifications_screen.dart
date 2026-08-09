import 'package:cms_doctor_app/core/api/services/notification_api_service.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/navigation/app_navigation.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  int _filterIndex = 0;
  static const _filters = ['All', 'Unread', 'Appointments', 'Leaves'];

  List<StaffNotification> _notifications = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await notificationApi.getStaffInbox();
      if (!mounted) return;
      setState(() {
        _notifications = list;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
        _notifications = [];
      });
    }
  }

  int get _unreadCount => _notifications.where((n) => n.isUnread).length;

  String _category(StaffNotification n) {
    final hay =
        '${n.title} ${n.body}'.toLowerCase();
    if (hay.contains('leave') || hay.contains('blocked')) return 'Leaves';
    if (hay.contains('appointment') ||
        hay.contains('visit') ||
        hay.contains('schedule') ||
        hay.contains('patient')) {
      return 'Appointments';
    }
    return 'All';
  }

  Color _color(StaffNotification n) {
    switch (_category(n)) {
      case 'Leaves':
        return const Color(0xFF43A047);
      case 'Appointments':
        return const Color(0xFF1E88E5);
      default:
        return const Color(0xFF929296);
    }
  }

  List<StaffNotification> get _visibleNotifications {
    switch (_filterIndex) {
      case 1:
        return _notifications.where((n) => n.isUnread).toList();
      case 2:
        return _notifications
            .where((n) => _category(n) == 'Appointments')
            .toList();
      case 3:
        return _notifications.where((n) => _category(n) == 'Leaves').toList();
      default:
        return _notifications;
    }
  }

  Future<void> _markAllRead() async {
    try {
      await notificationApi.markAllRead();
      await _load();
      if (mounted) showSnack(context, 'All notifications marked as read');
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    }
  }

  Future<void> _markRead(StaffNotification item) async {
    if (!item.isUnread) return;
    try {
      await notificationApi.markRead(item.id);
      await _load();
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    }
  }

  String _timeLabel(StaffNotification n) {
    final at = n.createdAt;
    if (at == null) return n.isUnread ? 'New' : 'Read';
    final local = at.toLocal();
    final now = DateTime.now();
    if (local.year == now.year &&
        local.month == now.month &&
        local.day == now.day) {
      return DateFormat.jm().format(local);
    }
    return DateFormat.MMMd().format(local);
  }

  @override
  Widget build(BuildContext context) {
    final visible = _visibleNotifications;

    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        children: [
          Container(
            color: const Color(0xFF0B74FA),
            padding: EdgeInsets.only(
              top: MediaQuery.paddingOf(context).top + 12,
              left: 16,
              right: 16,
              bottom: 16,
            ),
            child: Row(
              children: [
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: const Icon(Icons.arrow_back,
                      color: Colors.white, size: 22),
                ),
                const SizedBox(width: 12),
                const Text(
                  'Notifications',
                  style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w600,
                      color: Colors.white),
                ),
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.25),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '$_unreadCount',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const Spacer(),
                TextButton(
                  onPressed: _unreadCount == 0 ? null : _markAllRead,
                  child: Text(
                    'Mark all as read',
                    style: TextStyle(
                      fontSize: 13,
                      color: _unreadCount == 0 ? Colors.white54 : Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: List.generate(
                  _filters.length,
                  (i) => GestureDetector(
                    onTap: () => setState(() => _filterIndex = i),
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: _filterIndex == i
                            ? const Color(0xFF0B74FA)
                            : const Color(0xFFF2F2F2),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        _filters[i],
                        style: TextStyle(
                          fontSize: 14,
                          color: _filterIndex == i
                              ? Colors.white
                              : const Color(0xFF929296),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: _error != null
                        ? ListView(
                            children: [
                              Padding(
                                padding: const EdgeInsets.all(24),
                                child: Text(
                                  _error!,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(color: Colors.red),
                                ),
                              ),
                            ],
                          )
                        : visible.isEmpty
                            ? ListView(
                                children: const [
                                  SizedBox(height: 80),
                                  Center(
                                    child: Text(
                                      'No notifications in this category',
                                      style: TextStyle(
                                          fontSize: 16,
                                          color: Color(0xFF929296)),
                                    ),
                                  ),
                                ],
                              )
                            : ListView.separated(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 16),
                                itemCount: visible.length,
                                separatorBuilder: (_, __) =>
                                    const Divider(height: 1),
                                itemBuilder: (_, i) {
                                  final item = visible[i];
                                  final color = _color(item);
                                  final read = !item.isUnread;
                                  return InkWell(
                                    onTap: () => _markRead(item),
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(
                                          vertical: 12),
                                      child: Row(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Container(
                                            width: 42,
                                            height: 42,
                                            decoration: BoxDecoration(
                                              color: color.withValues(
                                                  alpha: 0.12),
                                              shape: BoxShape.circle,
                                            ),
                                            child: Icon(
                                                Icons.notifications_outlined,
                                                color: color,
                                                size: 22),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  _category(item),
                                                  style: TextStyle(
                                                      fontSize: 12,
                                                      color: color),
                                                ),
                                                Text(
                                                  item.title,
                                                  style: TextStyle(
                                                    fontSize: 15,
                                                    fontWeight: FontWeight.w600,
                                                    color: read
                                                        ? const Color(
                                                            0xFF929296)
                                                        : color,
                                                  ),
                                                ),
                                                Text(
                                                  item.body,
                                                  style: const TextStyle(
                                                    fontSize: 13,
                                                    color: Color(0xFF929296),
                                                    height: 1.5,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          Text(
                                            _timeLabel(item),
                                            style: const TextStyle(
                                                fontSize: 12,
                                                color: Color(0xFF929296)),
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                },
                              ),
                  ),
          ),
        ],
      ),
    );
  }
}
