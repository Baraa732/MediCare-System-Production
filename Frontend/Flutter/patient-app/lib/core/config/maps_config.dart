/// Google Maps API key used by the patient app.
///
/// Android reads the same value from `android/local.properties` via manifest
/// placeholders. Override at build time with:
/// `--dart-define=GOOGLE_MAPS_API_KEY=your_key`
class MapsConfig {
  MapsConfig._();

  static const String apiKey = String.fromEnvironment(
    'GOOGLE_MAPS_API_KEY',
    defaultValue: 'AIzaSyAAtJ6pmyOlyQ77q36kHpzgPjuz6XcTNPQ',
  );

  static bool get isConfigured => apiKey.isNotEmpty;
}
