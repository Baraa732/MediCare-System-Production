import '../../domain/entities/search.dart';

class SearchModel extends Search {
  const SearchModel(
      {required String data})
      : super(data: data);

  SearchModel copyWith({
    String? data,
  }) {
    return SearchModel(
      data: data ?? this.data  ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    "data": data,
  };

  factory SearchModel.fromJson(Map<String, dynamic> json) => SearchModel(
    data: json["data"],
  );
}

