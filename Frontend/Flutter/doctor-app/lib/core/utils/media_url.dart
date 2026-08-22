import 'package:cms_doctor_app/core/api/api_config.dart';

class MediaUrl {
  static String resolve(String? url) {
    if (url == null || url.trim().isEmpty) return '';
    final trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    final origin = ApiConfig.baseUrl.replaceAll(RegExp(r'/api/?$'), '');
    if (trimmed.startsWith('/')) return '$origin$trimmed';
    return '$origin/$trimmed';
  }
}
