/// MediCare API gateway configuration.
/// Override at build time: `--dart-define=API_BASE_URL=https://your-gateway/api`
class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue:
        'https://medicare-system-production-production.up.railway.app/api',
  );

  static const Duration connectTimeout = Duration(seconds: 20);
  static const Duration receiveTimeout = Duration(seconds: 30);
}
