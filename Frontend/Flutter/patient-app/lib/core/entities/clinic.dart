class Clinic {
  final String id;
  final String name;
  final String specialty;
  final String location;
  final String hours;
  final double? latitude;
  final double? longitude;
  final double rating;
  final bool isSaved;
  final String imageUrl;
  final String description;
  final String phone;
  final String email;
  final String address;
  final String city;
  final String governorate;

  Clinic({
    required this.id,
    required this.name,
    required this.specialty,
    required this.location,
    required this.hours,
    this.latitude,
    this.longitude,
    this.rating = 4.5,
    this.isSaved = false,
    this.imageUrl = '',
    this.description = '',
    this.phone = '',
    this.email = '',
    this.address = '',
    this.city = '',
    this.governorate = '',
  });

  bool get hasCoordinates => latitude != null && longitude != null;

  Clinic copyWith({
    String? id,
    String? name,
    String? specialty,
    String? location,
    String? hours,
    double? latitude,
    double? longitude,
    double? rating,
    bool? isSaved,
    String? imageUrl,
    String? description,
    String? phone,
    String? email,
    String? address,
    String? city,
    String? governorate,
  }) {
    return Clinic(
      id: id ?? this.id,
      name: name ?? this.name,
      specialty: specialty ?? this.specialty,
      location: location ?? this.location,
      hours: hours ?? this.hours,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      rating: rating ?? this.rating,
      isSaved: isSaved ?? this.isSaved,
      imageUrl: imageUrl ?? this.imageUrl,
      description: description ?? this.description,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      address: address ?? this.address,
      city: city ?? this.city,
      governorate: governorate ?? this.governorate,
    );
  }

  factory Clinic.fromJson(Map<String, dynamic> json) {
    return Clinic(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      specialty: json['specialty']?.toString() ?? '',
      location: json['location']?.toString() ?? '',
      hours: json['hours']?.toString() ?? '',
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      rating: (json['rating'] as num?)?.toDouble() ?? 4.5,
      isSaved: json['isSaved'] == true,
      imageUrl: json['imageUrl']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      city: json['city']?.toString() ?? '',
      governorate: json['governorate']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'specialty': specialty,
      'location': location,
      'hours': hours,
      'latitude': latitude,
      'longitude': longitude,
      'rating': rating,
      'isSaved': isSaved,
      'imageUrl': imageUrl,
      'description': description,
      'phone': phone,
      'email': email,
      'address': address,
      'city': city,
      'governorate': governorate,
    };
  }
}
