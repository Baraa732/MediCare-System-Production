import '../../domain/entities/map.dart';

class MapModel extends Map {
  const MapModel({required String data}) : super(data: data);

  MapModel copyWith({String? data}) {
    return MapModel(data: data ?? this.data ?? '');
  }

  // Map<String, dynamic> toJson() => {
  //   "data": data,
  // };

  // factory MapModel.fromJson(Map<String, dynamic> json) => MapModel(
  //   data: json["data"],
  // );
}
