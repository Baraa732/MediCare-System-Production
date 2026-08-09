import 'dart:math';

import 'package:cms_doctor_app/core/api/api_config.dart';
import 'package:cms_doctor_app/core/api/api_exception.dart';
import 'package:cms_doctor_app/core/storage/session_storage.dart';
import 'package:dio/dio.dart';

class ApiClient {
  ApiClient(this._sessionStorage) {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConfig.baseUrl,
        connectTimeout: ApiConfig.connectTimeout,
        receiveTimeout: ApiConfig.receiveTimeout,
        headers: const {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = _sessionStorage.accessToken;
          if (token != null &&
              token.isNotEmpty &&
              options.extra['skipAuth'] != true) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          final clinicId = _sessionStorage.clinicId;
          if (clinicId != null &&
              clinicId.isNotEmpty &&
              options.extra['skipTenant'] != true) {
            options.headers['X-Tenant-ID'] = clinicId;
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final status = error.response?.statusCode;
          final path = error.requestOptions.path;
          final isRefresh = path.contains('/auth/refresh-token');
          final alreadyRetried = error.requestOptions.extra['retried'] == true;

          if (status == 401 &&
              !isRefresh &&
              !alreadyRetried &&
              error.requestOptions.extra['skipAuth'] != true) {
            final refreshed = await _refreshAccessToken();
            if (refreshed != null) {
              final opts = error.requestOptions;
              opts.headers['Authorization'] = 'Bearer $refreshed';
              opts.extra['retried'] = true;
              try {
                final response = await _dio.fetch(opts);
                return handler.resolve(response);
              } catch (_) {}
            }
          }
          handler.next(error);
        },
      ),
    );
  }

  final SessionStorage _sessionStorage;
  late final Dio _dio;
  Future<String?>? _refreshInFlight;

  Future<String?> _refreshAccessToken() async {
    final refreshToken = _sessionStorage.refreshToken;
    if (refreshToken == null || refreshToken.isEmpty) {
      await _sessionStorage.clearSession();
      return null;
    }

    _refreshInFlight ??= () async {
      try {
        final response = await _dio.post(
          '/auth/refresh-token',
          data: {'refreshToken': refreshToken},
          options: Options(extra: {'skipAuth': true}),
        );
        final data = response.data as Map<String, dynamic>;
        final access = data['accessToken'] as String;
        final refresh = data['refreshToken'] as String? ?? refreshToken;
        await _sessionStorage.updateTokens(
          accessToken: access,
          refreshToken: refresh,
        );
        return access;
      } catch (_) {
        await _sessionStorage.clearSession();
        return null;
      } finally {
        _refreshInFlight = null;
      }
    }();

    return _refreshInFlight;
  }

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return _request(() => _dio.get<T>(
          path,
          queryParameters: queryParameters,
          options: options,
        ));
  }

  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Options? options,
  }) {
    return _request(() => _dio.post<T>(path, data: data, options: options));
  }

  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Options? options,
  }) {
    return _request(() => _dio.put<T>(path, data: data, options: options));
  }

  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Options? options,
  }) {
    return _request(() => _dio.patch<T>(path, data: data, options: options));
  }

  Future<Response<T>> _request<T>(Future<Response<T>> Function() call) async {
    try {
      return await call();
    } on DioException catch (e) {
      throw _mapDioError(e);
    }
  }

  ApiException _mapDioError(DioException error) {
    final response = error.response;
    if (response?.data != null) {
      return ApiException(
        messageFromResponse(response!.data),
        statusCode: response.statusCode,
      );
    }
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout) {
      return ApiException('Connection timed out. Check your network.');
    }
    if (error.type == DioExceptionType.connectionError) {
      return ApiException('Unable to reach MediCare servers.');
    }
    return ApiException(error.message ?? 'Network error');
  }
}

String newIdempotencyKey() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
      '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
      '${hex.substring(20, 32)}';
}
