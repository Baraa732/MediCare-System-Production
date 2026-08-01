class Appointment {
  final String id;
  final String doctorName;
  final String specialty;
  final String clinicName;
  final String clinicId;
  final String doctorId;
  final String date;
  final String time;
  final String status;
  final String? followUp;
  final DateTime? scheduledAt;

  Appointment({
    required this.id,
    required this.doctorName,
    required this.specialty,
    required this.clinicName,
    this.clinicId = '',
    this.doctorId = '',
    required this.date,
    required this.time,
    required this.status,
    this.followUp,
    this.scheduledAt,
  });
}
