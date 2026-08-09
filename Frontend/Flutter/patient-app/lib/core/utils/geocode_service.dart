import 'package:dio/dio.dart';

class GeocodeService {
  GeocodeService() : _dio = Dio();

  final Dio _dio;

  Future<({double lat, double lng})?> geocode(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return null;

    try {
      final response = await _dio.get<List<dynamic>>(
        'https://nominatim.openstreetmap.org/search',
        queryParameters: {
          'q': trimmed,
          'format': 'json',
          'limit': 1,
        },
        options: Options(
          headers: const {
            'User-Agent': 'MediCarePatientApp/1.0',
          },
          receiveTimeout: const Duration(seconds: 10),
          sendTimeout: const Duration(seconds: 10),
        ),
      );

      final results = response.data;
      if (results == null || results.isEmpty) return null;

      final first = results.first;
      if (first is! Map<String, dynamic>) return null;

      final lat = double.tryParse(first['lat']?.toString() ?? '');
      final lng = double.tryParse(first['lon']?.toString() ?? '');
      if (lat == null || lng == null) return null;

      return (lat: lat, lng: lng);
    } catch (_) {
      return null;
    }
  }
}
