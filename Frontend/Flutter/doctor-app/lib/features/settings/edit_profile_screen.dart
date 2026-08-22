import 'dart:io';

import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/utils/media_url.dart';
import '../../core/widgets/common_widgets.dart';

/// Full-screen doctor profile editor — avatar, identity, and specialty.
class EditDoctorProfileScreen extends StatefulWidget {
  const EditDoctorProfileScreen({super.key});

  @override
  State<EditDoctorProfileScreen> createState() =>
      _EditDoctorProfileScreenState();
}

class _EditDoctorProfileScreenState extends State<EditDoctorProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstCtrl = TextEditingController();
  final _lastCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _specCtrl = TextEditingController();

  String? _phone;
  String? _avatarUrl;
  File? _pickedImage;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _firstCtrl.dispose();
    _lastCtrl.dispose();
    _emailCtrl.dispose();
    _specCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final map = await authApi.fetchOwnProfile();
      if (!mounted) return;
      setState(() {
        _firstCtrl.text = map?['firstName']?.toString() ??
            sessionStorage.firstName ??
            '';
        _lastCtrl.text =
            map?['lastName']?.toString() ?? sessionStorage.lastName ?? '';
        _emailCtrl.text = map?['email']?.toString() ?? '';
        _specCtrl.text = map?['specialization']?.toString() ??
            map?['specialty']?.toString() ??
            '';
        _phone = map?['phoneNumber']?.toString() ?? map?['phone']?.toString();
        final profileData = map?['profileData'];
        _avatarUrl = map?['avatarUrl']?.toString() ??
            (profileData is Map
                ? profileData['avatarUrl']?.toString()
                : null);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _pickPhoto() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1200,
      maxHeight: 1200,
      imageQuality: 88,
    );
    if (file == null) return;
    setState(() => _pickedImage = File(file.path));
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate() || _saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await authApi.updateOwnProfile(
        firstName: _firstCtrl.text.trim(),
        lastName: _lastCtrl.text.trim(),
        email: _emailCtrl.text.trim().isEmpty ? null : _emailCtrl.text.trim(),
        specialization:
            _specCtrl.text.trim().isEmpty ? null : _specCtrl.text.trim(),
      );
      if (_pickedImage != null) {
        final uploaded = await authApi.uploadOwnAvatar(_pickedImage!);
        final profileData = uploaded['profileData'];
        _avatarUrl = uploaded['avatarUrl']?.toString() ??
            (profileData is Map
                ? profileData['avatarUrl']?.toString()
                : _avatarUrl);
        _pickedImage = null;
      }
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6F9),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: EdgeInsets.fromLTRB(8, top + 8, 16, 20),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF0B74FA), Color(0xFF0859C6)],
              ),
            ),
            child: Row(
              children: [
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                ),
                const Expanded(
                  child: Text(
                    'Edit profile',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : Form(
                    key: _formKey,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
                      children: [
                        _AvatarHero(
                          picked: _pickedImage,
                          networkUrl: _avatarUrl,
                          onTap: _pickPhoto,
                        ),
                        const SizedBox(height: 8),
                        Center(
                          child: TextButton.icon(
                            onPressed: _saving ? null : _pickPhoto,
                            icon: const Icon(Icons.photo_camera_outlined,
                                size: 18),
                            label: const Text('Change photo'),
                            style: TextButton.styleFrom(
                              foregroundColor: const Color(0xFF0B74FA),
                              textStyle: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 18),
                        _sectionCard(
                          title: 'Identity',
                          child: Column(
                            children: [
                              _field(
                                controller: _firstCtrl,
                                label: 'First name',
                                icon: Icons.badge_outlined,
                                validator: (v) =>
                                    (v == null || v.trim().isEmpty)
                                        ? 'Required'
                                        : null,
                              ),
                              const SizedBox(height: 12),
                              _field(
                                controller: _lastCtrl,
                                label: 'Last name',
                                icon: Icons.badge_outlined,
                                validator: (v) =>
                                    (v == null || v.trim().isEmpty)
                                        ? 'Required'
                                        : null,
                              ),
                              const SizedBox(height: 12),
                              _field(
                                controller: _emailCtrl,
                                label: 'Email',
                                icon: Icons.mail_outline_rounded,
                                keyboardType: TextInputType.emailAddress,
                              ),
                              const SizedBox(height: 12),
                              InputDecorator(
                                decoration: _decoration(
                                  label: 'Phone',
                                  icon: Icons.phone_outlined,
                                ),
                                child: Text(
                                  (_phone == null || _phone!.isEmpty)
                                      ? 'Managed by account security'
                                      : _phone!,
                                  style: TextStyle(
                                    fontSize: 15,
                                    color: (_phone == null || _phone!.isEmpty)
                                        ? const Color(0xFF929296)
                                        : const Color(0xFF1A1B1E),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),
                        _sectionCard(
                          title: 'Practice',
                          child: _field(
                            controller: _specCtrl,
                            label: 'Specialization',
                            icon: Icons.medical_services_outlined,
                            hint: 'e.g. Cardiology, Dentistry',
                          ),
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 14),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFEBEE),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              _error!,
                              style: const TextStyle(
                                color: Color(0xFFC62828),
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 22),
                        FilledButton(
                          onPressed: _saving ? null : _save,
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF0B74FA),
                            disabledBackgroundColor:
                                const Color(0xFF0B74FA).withValues(alpha: 0.5),
                            minimumSize: const Size.fromHeight(52),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          child: _saving
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.4,
                                    color: Colors.white,
                                  ),
                                )
                              : const Text(
                                  'Save changes',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                        ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _sectionCard({required String title, required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.4,
              color: Color(0xFF6B7280),
            ),
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  InputDecoration _decoration({
    required String label,
    required IconData icon,
    String? hint,
  }) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      prefixIcon: Icon(icon, color: const Color(0xFF0B74FA)),
      filled: true,
      fillColor: const Color(0xFFF7F9FC),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE8ECF2)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFF0B74FA), width: 1.4),
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    String? hint,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      textCapitalization: TextCapitalization.words,
      inputFormatters: [
        if (keyboardType == TextInputType.emailAddress)
          FilteringTextInputFormatter.deny(RegExp(r'\s')),
      ],
      validator: validator,
      decoration: _decoration(label: label, icon: icon, hint: hint),
    );
  }
}

class _AvatarHero extends StatelessWidget {
  const _AvatarHero({
    required this.picked,
    required this.networkUrl,
    required this.onTap,
  });

  final File? picked;
  final String? networkUrl;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: GestureDetector(
        onTap: onTap,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(
                  colors: [Color(0xFF0B74FA), Color(0xFF5AA7FF)],
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF0B74FA).withValues(alpha: 0.28),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: CircleAvatar(
                radius: 54,
                backgroundColor: Colors.white,
                child: ClipOval(
                  child: SizedBox(
                    width: 104,
                    height: 104,
                    child: picked != null
                        ? Image.file(picked!, fit: BoxFit.cover)
                        : (MediaUrl.resolve(networkUrl).isNotEmpty
                            ? Image.network(
                                MediaUrl.resolve(networkUrl),
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) =>
                                    doctorAvatar(radius: 52),
                              )
                            : doctorAvatar(radius: 52)),
                  ),
                ),
              ),
            ),
            Positioned(
              right: 2,
              bottom: 2,
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFF0B74FA),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 3),
                ),
                child: const Icon(Icons.add_a_photo_rounded,
                    color: Colors.white, size: 18),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
