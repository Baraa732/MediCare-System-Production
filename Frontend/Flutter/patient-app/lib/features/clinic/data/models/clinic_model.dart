import '../../domain/entities/clinic.dart';

class ClinicModel extends Clinic {
  const ClinicModel(
      {required String data})
      : super(data: data);

  ClinicModel copyWith({
    String? data,
  }) {
    return ClinicModel(
      data: data ?? this.data  ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    "data": data,
  };

  factory ClinicModel.fromJson(Map<String, dynamic> json) => ClinicModel(
    data: json["data"],
  );
}

