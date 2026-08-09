import '../../domain/entities/appointment.dart';

class AppointmentModel extends Appointment {
  const AppointmentModel(
      {required String data})
      : super(data: data);

  AppointmentModel copyWith({
    String? data,
  }) {
    return AppointmentModel(
      data: data ?? this.data  ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    "data": data,
  };

  factory AppointmentModel.fromJson(Map<String, dynamic> json) => AppointmentModel(
    data: json["data"],
  );
}

