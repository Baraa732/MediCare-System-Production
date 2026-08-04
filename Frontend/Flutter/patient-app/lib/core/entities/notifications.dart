enum NotificationType {
  alert,
  success,
  warning,
  system,
  read,
}

class NotificationItem {
  final String id;
  final String title;
  final String body;
  final String typeText;
  final String time;
  final NotificationType type;
  final DateTime? readAt;
  final DateTime? createdAt;

  NotificationItem({
    required this.id,
    required this.title,
    required this.body,
    required this.typeText,
    required this.time,
    required this.type,
    this.readAt,
    this.createdAt,
  });

  bool get isUnread => readAt == null;

  NotificationItem copyWith({
    String? id,
    String? title,
    String? body,
    String? typeText,
    String? time,
    NotificationType? type,
    DateTime? readAt,
    DateTime? createdAt,
    bool clearReadAt = false,
  }) {
    return NotificationItem(
      id: id ?? this.id,
      title: title ?? this.title,
      body: body ?? this.body,
      typeText: typeText ?? this.typeText,
      time: time ?? this.time,
      type: type ?? this.type,
      readAt: clearReadAt ? null : (readAt ?? this.readAt),
      createdAt: createdAt ?? this.createdAt,
    );
  }

  NotificationItem markReadNow() {
    return copyWith(
      readAt: DateTime.now(),
      type: NotificationType.read,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'body': body,
        'typeText': typeText,
        'time': time,
        'type': type.name,
        'readAt': readAt?.toIso8601String(),
        'createdAt': createdAt?.toIso8601String(),
      };

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      body: json['body']?.toString() ?? '',
      typeText: json['typeText']?.toString() ?? 'Update',
      time: json['time']?.toString() ?? 'Recently',
      type: NotificationType.values.firstWhere(
        (t) => t.name == json['type']?.toString(),
        orElse: () => NotificationType.system,
      ),
      readAt: json['readAt'] != null
          ? DateTime.tryParse(json['readAt'].toString())?.toLocal()
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())?.toLocal()
          : null,
    );
  }
}
