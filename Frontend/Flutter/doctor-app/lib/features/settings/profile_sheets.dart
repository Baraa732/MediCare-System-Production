import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';

Future<bool> showEditDoctorProfileSheet(
  BuildContext context, {
  required String firstName,
  required String lastName,
  String? email,
  String? specialization,
}) async {
  final firstCtrl = TextEditingController(text: firstName);
  final lastCtrl = TextEditingController(text: lastName);
  final emailCtrl = TextEditingController(text: email ?? '');
  final specCtrl = TextEditingController(text: specialization ?? '');
  var busy = false;
  String? error;

  final saved = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      return StatefulBuilder(
        builder: (ctx, setSheet) {
          final inset = MediaQuery.viewInsetsOf(ctx).bottom;
          return Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + inset),
            child: Material(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'Edit profile',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF1A1B1E),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: firstCtrl,
                        decoration: const InputDecoration(
                          labelText: 'First name',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: lastCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Last name',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: emailCtrl,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(
                          labelText: 'Email',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: specCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Specialization',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      if (error != null) ...[
                        const SizedBox(height: 10),
                        Text(error!,
                            style: const TextStyle(color: Color(0xFFE53935))),
                      ],
                      const SizedBox(height: 14),
                      FilledButton(
                        onPressed: busy
                            ? null
                            : () async {
                                if (firstCtrl.text.trim().isEmpty ||
                                    lastCtrl.text.trim().isEmpty) {
                                  setSheet(() =>
                                      error = 'First and last name are required');
                                  return;
                                }
                                setSheet(() {
                                  busy = true;
                                  error = null;
                                });
                                try {
                                  await authApi.updateOwnProfile(
                                    firstName: firstCtrl.text.trim(),
                                    lastName: lastCtrl.text.trim(),
                                    email: emailCtrl.text.trim().isEmpty
                                        ? null
                                        : emailCtrl.text.trim(),
                                    specialization: specCtrl.text.trim().isEmpty
                                        ? null
                                        : specCtrl.text.trim(),
                                  );
                                  if (ctx.mounted) Navigator.pop(ctx, true);
                                } catch (e) {
                                  setSheet(() {
                                    busy = false;
                                    error = e.toString();
                                  });
                                }
                              },
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF0B74FA),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: Text(busy ? 'Saving…' : 'Save profile'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      );
    },
  );

  firstCtrl.dispose();
  lastCtrl.dispose();
  emailCtrl.dispose();
  specCtrl.dispose();
  return saved == true;
}

Future<bool> showChangePasswordSheet(BuildContext context) async {
  final currentCtrl = TextEditingController();
  final newCtrl = TextEditingController();
  final confirmCtrl = TextEditingController();
  var busy = false;
  String? error;
  final pattern = RegExp(
    r'''^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$''',
  );

  final saved = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      return StatefulBuilder(
        builder: (ctx, setSheet) {
          final inset = MediaQuery.viewInsetsOf(ctx).bottom;
          return Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + inset),
            child: Material(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Change password',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1A1B1E),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: currentCtrl,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Current password',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: newCtrl,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'New password',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: confirmCtrl,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Confirm new password',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Must be 8+ characters with upper, lower, number, and special character.',
                      style: TextStyle(fontSize: 12, color: Color(0xFF929296)),
                    ),
                    if (error != null) ...[
                      const SizedBox(height: 10),
                      Text(error!,
                          style: const TextStyle(color: Color(0xFFE53935))),
                    ],
                    const SizedBox(height: 14),
                    FilledButton(
                      onPressed: busy
                          ? null
                          : () async {
                              if (!pattern.hasMatch(newCtrl.text)) {
                                setSheet(() => error =
                                    'Password must be 8+ chars with upper, lower, number, and special character');
                                return;
                              }
                              if (newCtrl.text != confirmCtrl.text) {
                                setSheet(() => error = 'Passwords do not match');
                                return;
                              }
                              setSheet(() {
                                busy = true;
                                error = null;
                              });
                              try {
                                await authApi.changePassword(
                                  currentPassword: currentCtrl.text,
                                  newPassword: newCtrl.text,
                                );
                                if (ctx.mounted) Navigator.pop(ctx, true);
                              } catch (e) {
                                setSheet(() {
                                  busy = false;
                                  error = e.toString();
                                });
                              }
                            },
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF0B74FA),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: Text(busy ? 'Updating…' : 'Update password'),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      );
    },
  );

  currentCtrl.dispose();
  newCtrl.dispose();
  confirmCtrl.dispose();
  return saved == true;
}
