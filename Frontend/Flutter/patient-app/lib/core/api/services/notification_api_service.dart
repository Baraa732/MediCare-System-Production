import 'package:cms/core/api/api_client.dart';
import 'package:cms/core/api/entity_mappers.dart';
import 'package:cms/core/entities/notifications.dart';

class NotificationInboxResult {
  const NotificationInboxResult({
    required this.items,
    required this.unreadCount,
    required this.total,
  });

  final List<NotificationItem> items;
  final int unreadCount;
  final int total;
}

class NotificationApiService {
  NotificationApiService(this._client);

  final ApiClient _client;

  Future<List<NotificationItem>> getMyNotifications({
    int page = 1,
    int limit = 20,
  }) async {
    final inbox = await fetchInbox(page: page, limit: limit);
    return inbox.items;
  }

  Future<NotificationInboxResult> fetchInbox({
    int page = 1,
    int limit = 20,
    bool unreadOnly = false,
  }) async {
    final response = await _client.get(
      '/notifications/me',
      queryParameters: {
        'page': page,
        'limit': limit,
        if (unreadOnly) 'unreadOnly': 'true',
      },
    );
    final data = response.data as Map<String, dynamic>;
    final items = data['items'] as List<dynamic>? ?? [];
    return NotificationInboxResult(
      items: items
          .whereType<Map<String, dynamic>>()
          .map(EntityMappers.notificationFromJson)
          .toList(),
      unreadCount: (data['unreadCount'] as num?)?.toInt() ?? 0,
      total: (data['total'] as num?)?.toInt() ?? items.length,
    );
  }

  Future<void> registerPushDevice({
    required String fcmToken,
    String platform = 'android',
    String? deviceLabel,
  }) async {
    await _client.post(
      '/notifications/patient/push/register',
      data: {
        'fcmToken': fcmToken,
        'platform': platform,
        if (deviceLabel != null) 'deviceLabel': deviceLabel,
      },
    );
  }

  Future<void> unregisterPushDevice({required String fcmToken}) async {
    await _client.delete(
      '/notifications/patient/push/register',
      data: {'fcmToken': fcmToken},
    );
  }

  Future<void> markNotificationRead(String id) async {
    await _client.patch('/notifications/me/$id/read');
  }

  Future<void> markAllNotificationsRead() async {
    await _client.patch('/notifications/me/read-all');
  }
}
