/// Matches auth-service PASSWORD_REGEX requirements.
String? validateMediCarePassword(String value) {
  if (value.isEmpty) return 'Password is required';
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (!RegExp(r'[A-Z]').hasMatch(value)) return 'Include an uppercase letter';
  if (!RegExp(r'[a-z]').hasMatch(value)) return 'Include a lowercase letter';
  if (!RegExp(r'[0-9]').hasMatch(value)) return 'Include a number';
  if (!RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(value)) {
    return 'Include a special character';
  }
  return null;
}

String? validatePasswordConfirmation(String password, String confirm) {
  if (confirm.isEmpty) return 'Please confirm your password';
  if (password != confirm) return 'Passwords do not match';
  return null;
}
