import 'dart:convert';

import 'package:cms/core/entities/notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

class NotificationLocalStore {
  static const _cacheKey = 'medicare_notification_inbox_cache';
  static const _pendingReadKey = 'medicare_notification_pending_read';
  static const _pendingReadAllKey = 'medicare_notification_pending_read_all';
  static const _lastSyncKey = 'medicare_notification_last_sync';

  NotificationLocalStore(this._prefs);

  final SharedPreferences _prefs;

  Future<void> saveInbox(List<NotificationItem> items) async {
    final encoded = items.map((item) => item.toJson()).toList();
    await _prefs.setString(_cacheKey, jsonEncode(encoded));
    await _prefs.setString(_lastSyncKey, DateTime.now().toIso8601String());
  }

  List<NotificationItem> loadInbox() {
    final raw = _prefs.getString(_cacheKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      return list
          .whereType<Map<String, dynamic>>()
          .map(NotificationItem.fromJson)
          .toList();
    } catch (_) {
      return [];
    }
  }

  DateTime? get lastSyncAt {
    final raw = _prefs.getString(_lastSyncKey);
    return raw != null ? DateTime.tryParse(raw)?.toLocal() : null;
  }

  Future<void> upsertNotification(NotificationItem item) async {
    final current = loadInbox();
    final index = current.indexWhere((n) => n.id == item.id);
    if (index >= 0) {
      current[index] = item;
    } else {
      current.insert(0, item);
    }
    await saveInbox(current);
  }

  Future<void> removeById(String id) async {
    final current = loadInbox()..removeWhere((n) => n.id == id);
    await saveInbox(current);
  }

  Future<void> queueMarkRead(String id) async {
    final pending = pendingReadIds.toSet()..add(id);
    await _prefs.setStringList(_pendingReadKey, pending.toList());
  }

  Future<void> queueMarkAllRead() async {
    await _prefs.setBool(_pendingReadAllKey, true);
  }

  Set<String> get pendingReadIds {
    return _prefs.getStringList(_pendingReadKey)?.toSet() ?? {};
  }

  bool get pendingReadAll => _prefs.getBool(_pendingReadAllKey) ?? false;

  Future<void> clearPendingRead(String id) async {
    final pending = pendingReadIds.toSet()..remove(id);
    await _prefs.setStringList(_pendingReadKey, pending.toList());
  }

  Future<void> clearPendingReadAll() async {
    await _prefs.remove(_pendingReadAllKey);
  }

  Future<void> clearAllPendingReads() async {
    await _prefs.remove(_pendingReadKey);
    await _prefs.remove(_pendingReadAllKey);
  }

  Future<void> clear() async {
    await _prefs.remove(_cacheKey);
    await _prefs.remove(_lastSyncKey);
    await clearAllPendingReads();
  }
}
