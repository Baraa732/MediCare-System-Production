import 'package:flutter/material.dart';

import 'login_screen.dart';

Widget backToLoginButton(BuildContext context) => SizedBox(
width: double.infinity,
child: ElevatedButton.icon(
onPressed: () => Navigator.pushAndRemoveUntil(
context,
MaterialPageRoute(builder: (_) => const LoginScreen()),
(r) => false,
),
icon: const Icon(Icons.arrow_back, size: 16),
label: const Text(
'Back to Login',
style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
),
style: ElevatedButton.styleFrom(
backgroundColor: const Color(0xFF0B74FA),
foregroundColor: Colors.white,
padding: const EdgeInsets.symmetric(vertical: 14),
shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
elevation: 0,
),
),
);
