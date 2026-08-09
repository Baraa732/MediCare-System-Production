import 'dart:convert';

import 'package:cms/core/entities/clinic.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Local bookmarks for clinics (profile Saved section).
class SavedClinicsStore {
  SavedClinicsStore(this._prefs);

  static const _key = 'medicare_saved_clinics_v1';
  final SharedPreferences _prefs;

  List<Clinic> load() {
    final raw = _prefs.getString(_key);
    if (raw == null || raw.isEmpty) return [];
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      return list
          .whereType<Map<String, dynamic>>()
          .map(Clinic.fromJson)
          .map((c) => c.copyWith(isSaved: true))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Set<String> get ids => load().map((c) => c.id).toSet();

  bool isSaved(String clinicId) => ids.contains(clinicId);

  Future<bool> toggle(Clinic clinic) async {
    final current = load();
    final index = current.indexWhere((c) => c.id == clinic.id);
    if (index >= 0) {
      current.removeAt(index);
      await _persist(current);
      return false;
    }
    current.insert(0, clinic.copyWith(isSaved: true));
    await _persist(current);
    return true;
  }

  Future<void> remove(String clinicId) async {
    final current = load()..removeWhere((c) => c.id == clinicId);
    await _persist(current);
  }

  Future<void> _persist(List<Clinic> clinics) async {
    final encoded = clinics.map((c) => c.copyWith(isSaved: true).toJson()).toList();
    await _prefs.setString(_key, jsonEncode(encoded));
  }
}
