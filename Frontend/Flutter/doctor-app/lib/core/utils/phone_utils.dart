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
