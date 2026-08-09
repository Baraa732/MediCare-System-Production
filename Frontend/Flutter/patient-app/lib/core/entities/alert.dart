class Alert {
  final String id;
  final String time; // e.g., "5 minutes ago"
  final String message;
  final bool isLate; // true = late, false = upcoming

  Alert({
    required this.id,
    required this.time,
    required this.message,
    this.isLate = false,
  });
}