import 'package:cms/core/storage/session_storage.dart';
import 'package:cms/injection_container.dart';

/// Headers for Image.network / media fetches that hit authenticated CDN-like routes.
class AuthMediaHeaders {
  static Map<String, String> bearer() {
    try {
      final token = getIt<SessionStorage>().accessToken;
      if (token == null || token.isEmpty) return const {};
      return {'Authorization': 'Bearer $token'};
    } catch (_) {
      return const {};
    }
  }
}
