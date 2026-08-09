class History {
  final String id;
  final String clinicName;
  final String location;
  final String timeVisited; // e.g., "3 months ago"

  History({
    required this.id,
    required this.clinicName,
    required this.location,
    required this.timeVisited,
  });
}