import 'package:cms/core/api/api_client.dart';
import 'package:cms/core/api/entity_mappers.dart';
import 'package:cms/core/entities/clinic.dart';
import 'package:cms/core/entities/doctor.dart';

class ClinicApiService {
  ClinicApiService(this._client);

  final ApiClient _client;

  Future<List<Clinic>> listClinics({String status = 'ACTIVE'}) async {
    final response = await _client.get(
      '/clinics',
      queryParameters: {'status': status},
    );
    final data = response.data as Map<String, dynamic>;
    final list = data['clinics'] as List<dynamic>? ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(EntityMappers.clinicFromJson)
        .toList();
  }

  Future<List<Clinic>> searchClinics({
    String? query,
    String? city,
    String? governorate,
    String? specialization,
    int page = 1,
    int limit = 20,
  }) async {
    final response = await _client.get(
      '/clinics/search',
      queryParameters: {
        if (query != null && query.isNotEmpty) 'q': query,
        if (city != null && city.isNotEmpty) 'city': city,
        if (governorate != null && governorate.isNotEmpty) 'governorate': governorate,
        if (specialization != null && specialization.isNotEmpty)
          'specialization': specialization,
        'page': page,
        'limit': limit,
      },
    );
    final data = response.data as Map<String, dynamic>;
    final list = data['clinics'] as List<dynamic>? ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(EntityMappers.clinicFromJson)
        .toList();
  }

  Future<Clinic> getClinic(String clinicId) async {
    final response = await _client.get('/clinics/$clinicId');
    final data = response.data as Map<String, dynamic>;
    final clinicJson =
        data['clinic'] as Map<String, dynamic>? ?? data;
    return EntityMappers.clinicFromJson(clinicJson);
  }

  Future<List<Doctor>> getClinicDoctors(String clinicId) async {
    final response = await _client.get('/clinics/$clinicId/doctors');
    final data = response.data as Map<String, dynamic>;
    final list = data['doctors'] as List<dynamic>? ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map((d) => EntityMappers.doctorFromJson(d))
        .toList();
  }
}
