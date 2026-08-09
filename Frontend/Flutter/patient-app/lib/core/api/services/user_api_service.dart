import 'package:cms/core/utils/media_url.dart';
import 'package:cms/core/api/api_client.dart';

class PatientProfile {
  final String id;
  final String firstName;
  final String lastName;
  final String? email;
  final String phoneNumber;
  final String? gender;
  final String? birthDate;
  final String? avatarUrl;

  PatientProfile({
    required this.id,
    required this.firstName,
    required this.lastName,
    this.email,
    required this.phoneNumber,
    this.gender,
    this.birthDate,
    this.avatarUrl,
  });

  String get fullName => '$firstName $lastName'.trim();

  factory PatientProfile.fromJson(Map<String, dynamic> json) {
    final profileData = json['profileData'] as Map<String, dynamic>?;
    return PatientProfile(
      id: json['id']?.toString() ?? '',
      firstName: json['firstName']?.toString() ?? '',
      lastName: json['lastName']?.toString() ?? '',
      email: json['email']?.toString(),
      phoneNumber: json['phoneNumber']?.toString() ?? '',
      gender: json['gender']?.toString(),
      birthDate: json['birthDate']?.toString(),
      avatarUrl: MediaUrl.resolve(profileData?['avatarUrl']?.toString()),
    );
  }
}

class UserApiService {
  UserApiService(this._client);

  final ApiClient _client;

  Future<PatientProfile> getProfile(String userId) async {
    final response = await _client.get('/users/$userId');
    final data = response.data;
    if (data is Map<String, dynamic>) {
      return PatientProfile.fromJson(data);
    }
    throw Exception('Invalid profile response');
  }

  Future<PatientProfile> updateProfile(
    String userId, {
    String? firstName,
    String? lastName,
    String? email,
  }) async {
    final response = await _client.put(
      '/users/$userId',
      data: {
        if (firstName != null) 'firstName': firstName,
        if (lastName != null) 'lastName': lastName,
        if (email != null) 'email': email,
      },
    );
    return PatientProfile.fromJson(response.data as Map<String, dynamic>);
  }
}
