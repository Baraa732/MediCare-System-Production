import 'package:flutter/material.dart';

import '../navigation/app_navigation.dart';

Future<void> showInfoDialog(
  BuildContext context, {
  required String title,
  required String body,
}) {
  return showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: SingleChildScrollView(child: Text(body)),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Close'),
        ),
      ],
    ),
  );
}

void showTermsDialog(BuildContext context) {
  showInfoDialog(
    context,
    title: 'Terms of Service',
    body: 'By using the Doctors App, you agree to follow clinic policies, '
        'protect patient confidentiality, and use the platform only for '
        'authorized medical workflows. Continued access may require periodic '
        'verification of your clinic affiliation.',
  );
}

void showPrivacyDialog(BuildContext context) {
  showInfoDialog(
    context,
    title: 'Privacy Policy',
    body: 'We process account, schedule, and patient data to support clinical '
        'operations. Data is shared only with your clinic and authorized staff. '
        'You can request account deactivation through your clinic administrator.',
  );
}

void showAboutUsDialog(BuildContext context) {
  showInfoDialog(
    context,
    title: 'About Us',
    body: 'Doctors App helps clinic staff manage schedules, patients, shifts, '
        'and visit workflows in one place. This build is a demo of the doctor-facing experience.',
  );
}

void showHelpDialog(BuildContext context) {
  showInfoDialog(
    context,
    title: 'Help Center & FAQ',
    body: '• Log in with your clinic phone number and password.\n'
        '• Confirm your account using the WhatsApp verification code.\n'
        '• Use Schedule to review daily appointments and complete visits.\n'
        '• Request leave from the Shifts tab when you need time off.\n'
        '• Contact your clinic administrator for access or account issues.',
  );
}

void showContactDialog(BuildContext context) {
  showInfoDialog(
    context,
    title: 'Contact Us',
    body: 'Technical support\n'
        'Phone: +966 50 123 4567\n'
        'Email: support@doctorsapp.example\n\n'
        'For clinic access or account reactivation, contact your clinic administrator first.',
  );
}

void showContactSupportSnack(BuildContext context) {
  showSnack(context, 'Support team notified — we will contact you shortly');
}
