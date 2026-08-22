import 'dart:convert';

/// Secretary dashboard embeds scheduling metadata in appointment.notes as JSON.
/// Doctors should only see the human-readable `text` field.

Map<String, dynamic> parseAppointmentNotesMetadata(String? notes) {
  if (notes == null || notes.trim().isEmpty) return {};
  final trimmed = notes.trim();
  if (!trimmed.startsWith('{')) return {};
  try {
    final parsed = jsonDecode(trimmed);
    if (parsed is Map<String, dynamic>) return parsed;
    if (parsed is Map) return Map<String, dynamic>.from(parsed);
  } catch (_) {}
  return {};
}

String? _normalizeGender(dynamic raw) {
  if (raw is! String || raw.trim().isEmpty) return null;
  final v = raw.trim().toLowerCase();
  if (v == 'male' || v == 'm') return 'MALE';
  if (v == 'female' || v == 'f') return 'FEMALE';
  return raw.trim().toUpperCase();
}

int? _parseAge(dynamic raw) {
  if (raw is int) {
    return raw >= 0 && raw <= 120 ? raw : null;
  }
  if (raw is num) {
    final age = raw.round();
    return age >= 0 && age <= 120 ? age : null;
  }
  if (raw is String && RegExp(r'^\d+$').hasMatch(raw.trim())) {
    final age = int.tryParse(raw.trim());
    if (age != null && age >= 0 && age <= 120) return age;
  }
  return null;
}

String? approximateBirthDateFromAge(int age) {
  final year = DateTime.now().year - age;
  return '$year-01-01';
}

String? patientGenderFromStoredNotes(String? notes) {
  final meta = parseAppointmentNotesMetadata(notes);
  return _normalizeGender(meta['patientGender']);
}

int? patientAgeFromStoredNotes(String? notes) {
  final meta = parseAppointmentNotesMetadata(notes);
  return _parseAge(meta['patientAge']);
}

String? patientBirthDateFromStoredNotes(String? notes) {
  final age = patientAgeFromStoredNotes(notes);
  if (age == null) return null;
  return approximateBirthDateFromAge(age);
}

String? displayNotesFromStored(String? notes) {
  if (notes == null || notes.trim().isEmpty) return null;
  final meta = parseAppointmentNotesMetadata(notes);
  if (meta.containsKey('text') && meta['text'] is String) {
    final text = (meta['text'] as String).trim();
    return text.isEmpty ? null : text;
  }
  if (notes.trim().startsWith('{')) return null;
  return notes.trim();
}

bool hasDisplayNotes(String? notes) =>
    displayNotesFromStored(notes)?.isNotEmpty == true;

String? encodeAppointmentNotes(
  String? userNotes, {
  String? complexity,
  bool? refuseTransfer,
  String? patientGender,
  int? patientAge,
}) {
  final text = userNotes?.trim() ?? '';
  final normalizedComplexity = complexity?.trim().toLowerCase();
  final nonDefaultComplexity = normalizedComplexity != null &&
          normalizedComplexity.isNotEmpty &&
          normalizedComplexity != 'standard'
      ? normalizedComplexity
      : null;
  final locked = refuseTransfer == true;
  final gender = _normalizeGender(patientGender);
  final age = patientAge != null && patientAge >= 0 && patientAge <= 120
      ? patientAge
      : null;
  if (nonDefaultComplexity == null && !locked && gender == null && age == null) {
    return text.isEmpty ? null : text;
  }
  return jsonEncode({
    'text': text,
    if (nonDefaultComplexity != null) 'complexity': nonDefaultComplexity,
    if (locked) 'refuseTransfer': true,
    if (gender != null) 'patientGender': gender,
    if (age != null) 'patientAge': age,
  });
}

/// Preserve secretary metadata when the doctor edits visit notes.
String? mergeAppointmentNotes(String? storedNotes, String userText) {
  final meta = parseAppointmentNotesMetadata(storedNotes);
  final complexity = meta['complexity'] is String ? meta['complexity'] as String : null;
  final refuseTransfer = meta['refuseTransfer'] == true ||
      meta['lockedToDoctor'] == true ||
      meta['isLockedToDoctor'] == true;
  return encodeAppointmentNotes(
    userText,
    complexity: complexity,
    refuseTransfer: refuseTransfer ? true : null,
    patientGender: patientGenderFromStoredNotes(storedNotes),
    patientAge: patientAgeFromStoredNotes(storedNotes),
  );
}
