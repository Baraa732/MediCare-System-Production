import 'package:cms_doctor_app/core/api/api_client.dart';

class StaffNotification {
  final String id;
  final String title;
  final String body;
  final bool isUnread;
  final DateTime? createdAt;

  const StaffNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.isUnread,
    this.createdAt,
  });

  factory StaffNotification.fromJson(Map<String, dynamic> json) {
    return StaffNotification(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Notification',
      body: json['body']?.toString() ?? json['message']?.toString() ?? '',
      isUnread: json['isUnread'] == true ||
          json['read'] == false ||
          json['readAt'] == null,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }
}

class NotificationApiService {
  NotificationApiService(this._client);

  final ApiClient _client;

  Future<List<StaffNotification>> getStaffInbox({int limit = 50}) async {
    final response = await _client.get(
      '/notifications/staff/inbox',
      queryParameters: {'page': 1, 'limit': limit},
    );
    final data = response.data;
    List list = const [];
    if (data is Map) {
      list = (data['items'] ?? data['notifications'] ?? data['data'] ?? [])
          as List? ??
          [];
    } else if (data is List) {
      list = data;
    }
    return list
        .whereType<Map>()
        .map((e) => StaffNotification.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<void> markRead(String id) async {
    await _client.patch('/notifications/staff/inbox/$id/read');
  }

  Future<void> markAllRead() async {
    await _client.patch('/notifications/staff/inbox/read-all');
  }
}
