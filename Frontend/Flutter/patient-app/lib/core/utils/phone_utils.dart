/// Normalizes Syrian local numbers (09xxxxxxxx) to E.164 (+9639xxxxxxxx).
String formatPhoneForApi(String raw) {
  final digits = raw.replaceAll(RegExp(r'[^0-9+]'), '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('963')) return '+$digits';
  if (digits.startsWith('09') && digits.length == 10) {
    return '+963${digits.substring(1)}';
  }
  if (digits.startsWith('9') && digits.length == 9) {
    return '+963$digits';
  }
  return digits.startsWith('+') ? digits : '+$digits';
}

String displayPhone(String? e164) {
  if (e164 == null || e164.isEmpty) return '';
  final digits = e164.replaceAll(RegExp(r'[^0-9]'), '');
  if (digits.startsWith('963') && digits.length >= 12) {
    return '0${digits.substring(3)}';
  }
  return e164;
}
