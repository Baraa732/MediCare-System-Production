import '../../domain/entities/home.dart';

class HomeModel extends Home {
  const HomeModel(
      {required String data})
      : super(data: data);

  HomeModel copyWith({
    String? data,
  }) {
    return HomeModel(
      data: data ?? this.data  ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    "data": data,
  };

  factory HomeModel.fromJson(Map<String, dynamic> json) => HomeModel(
    data: json["data"],
  );
}

