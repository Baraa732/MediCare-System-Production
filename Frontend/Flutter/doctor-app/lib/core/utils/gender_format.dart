/// Normalizes patient gender for doctor-app UI.
bool isUnknownGender(String? value) {
  if (value == null) return true;
  final normalized = value.trim().toLowerCase();
  if (normalized.isEmpty) return true;
  return normalized == 'unknown' ||
      normalized == 'other' ||
      normalized == 'u' ||
      normalized == '—' ||
      normalized == '-';
}

String formatDisplayGender(String? value) {
  if (isUnknownGender(value)) return '—';
  final normalized = value!.trim().toLowerCase();
  if (normalized == 'm' || normalized == 'male') return 'Male';
  if (normalized == 'f' || normalized == 'female') return 'Female';
  if (value.trim().length == 1) {
    return value.trim().toUpperCase();
  }
  return value.trim()[0].toUpperCase() + value.trim().substring(1).toLowerCase();
}

String pickDisplayGender(Iterable<String?> candidates) {
  for (final candidate in candidates) {
    if (!isUnknownGender(candidate)) {
      return formatDisplayGender(candidate);
    }
  }
  return '—';
}
