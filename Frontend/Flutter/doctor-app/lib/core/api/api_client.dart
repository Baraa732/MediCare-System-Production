/// HTTP client with X-Tenant-ID header injection for doctor-app.
library;

import 'dart:convert';
import 'package:http/http.dart' as http;
import 'auth_store.dart';

class ApiClient {
  ApiClient({required this.baseUrl, required this.authStore});

  final String baseUrl;
  final AuthStore authStore;

  Future<http.Response> request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    String? token,
  }) async {
    final tenantId = authStore.session?.effectiveTenantId;
    final uri = Uri.parse('$baseUrl$path');
    final headers = <String, String>{
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
      if (tenantId != null && tenantId.isNotEmpty) 'X-Tenant-ID': tenantId,
    };

    switch (method.toUpperCase()) {
      case 'GET':
        return http.get(uri, headers: headers);
      case 'POST':
        return http.post(uri, headers: headers, body: jsonEncode(body ?? {}));
      case 'PUT':
        return http.put(uri, headers: headers, body: jsonEncode(body ?? {}));
      case 'DELETE':
        return http.delete(uri, headers: headers);
      default:
        throw UnsupportedError('HTTP method $method not supported');
    }
  }
}
