import '../../domain/entities/booking.dart';

class BookingModel extends Booking {
  const BookingModel(
      {required String data})
      : super(data: data);

  BookingModel copyWith({
    String? data,
  }) {
    return BookingModel(
      data: data ?? this.data  ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    "data": data,
  };

  factory BookingModel.fromJson(Map<String, dynamic> json) => BookingModel(
    data: json["data"],
  );
}

