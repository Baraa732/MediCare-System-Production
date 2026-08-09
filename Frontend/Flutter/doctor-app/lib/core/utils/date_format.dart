const weekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

final DateTime scheduleDemoToday = DateTime(2024, 10, 7);

String formatScheduleDate(DateTime date) {
  return '${weekdays[date.weekday - 1]}, ${months[date.month - 1]} ${date.day}';
}

bool isSameDay(DateTime a, DateTime b) {
  return a.year == b.year && a.month == b.month && a.day == b.day;
}
