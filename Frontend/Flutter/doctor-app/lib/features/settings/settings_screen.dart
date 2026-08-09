import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/constants/app_assets.dart';
import '../../core/layout/app_shell.dart';
import '../../core/navigation/app_navigation.dart';
import '../../core/utils/app_dialogs.dart';
import '../../core/widgets/language_selector.dart';
import '../auth/forgot_password_screen.dart';
import '../auth/login_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  int _navIndex = 3;
  bool _loggingOut = false;

  Future<void> _signOut() async {
    if (_loggingOut) return;
    setState(() => _loggingOut = true);
    try {
      await authApi.logout();
    } catch (_) {
      // Still clear local session via logout's finally path / clear below
    }
    if (!mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (r) => false,
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: const Color(0xFFF5F5F5),
        body: Column(
          children: [
            Container(
              color: const Color(0xFF0B74FA),
              padding: EdgeInsets.only(
                top: MediaQuery.paddingOf(context).top + 12,
                left: 16,
                right: 16,
                bottom: 16,
              ),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Settings',
                      style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          color: Colors.white),
                    ),
                  ),
                  notificationButton(onTap: () => openNotifications(context)),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Container(
                    decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: [
                        const CircleAvatar(
                          radius: 28,
                          backgroundColor: Color(0xFFDBDBDC),
                          backgroundImage: AssetImage(AppAssets.doctorPic),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Dr. ${sessionStorage.displayName}',
                                style: const TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF1A1B1E),
                                ),
                              ),
                              Row(
                                children: [
                                  SvgPicture.asset(AppAssets.dentist,
                                      width: 12, height: 12),
                                  const SizedBox(width: 4),
                                  Text(
                                    sessionStorage.clinicId == null
                                        ? 'Doctor'
                                        : 'Clinic doctor',
                                    style: const TextStyle(
                                        fontSize: 14,
                                        color: Color(0xFF929296)),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  _sectionLabel('Application'),
                  _settingsGroup([
                    SettingRow(
                      icon: Icons.notifications_outlined,
                      label: 'Notifications',
                      onTap: () => openNotifications(context),
                    ),
                    SettingRow(
                      icon: Icons.translate_outlined,
                      label: 'App Language',
                      hasArrow: false,
                      hasDropdown: true,
                      onTap: () => showLanguagePicker(context),
                    ),
                    SettingRow(
                      icon: Icons.lock_outline,
                      label: 'Password & Security',
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const ForgotPasswordScreen()),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 16),
                  _sectionLabel('Support'),
                  _settingsGroup([
                    SettingRow(
                      icon: Icons.list_alt_outlined,
                      label: 'About Us',
                      onTap: () => showAboutUsDialog(context),
                    ),
                    SettingRow(
                      icon: Icons.help_outline,
                      label: 'Help Center & FAQ',
                      onTap: () => showHelpDialog(context),
                    ),
                    SettingRow(
                      icon: Icons.phone_outlined,
                      label: 'Contact Us',
                      onTap: () => showContactDialog(context),
                    ),
                  ]),
                  const SizedBox(height: 16),
                  GestureDetector(
                    onTap: _loggingOut ? null : _signOut,
                    child: Container(
                      height: 52,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF1F1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          if (_loggingOut)
                            const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          else ...[
                            const Icon(Icons.logout,
                                color: Color(0xFFE53935), size: 20),
                            const SizedBox(width: 8),
                            const Text(
                              'Sign out',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFFE53935),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        bottomNavigationBar: buildBottomNav(
            _navIndex, (i) => switchMainTab(context, _navIndex, i)),
      );

  Widget _sectionLabel(String label) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(
          label,
          style: const TextStyle(
              fontSize: 13, color: Color(0xFF929296), letterSpacing: 0.3),
        ),
      );

  Widget _settingsGroup(List<SettingRow> items) => Container(
        decoration: BoxDecoration(
            color: Colors.white, borderRadius: BorderRadius.circular(12)),
        child: Column(
          children: items.asMap().entries.map((e) {
            final isLast = e.key == items.length - 1;
            return Column(
              children: [
                e.value,
                if (!isLast) const Divider(height: 1, indent: 52),
              ],
            );
          }).toList(),
        ),
      );
}

class SettingRow extends StatelessWidget {
  const SettingRow({
    super.key,
    required this.icon,
    required this.label,
    this.hasArrow = true,
    this.hasDropdown = false,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final bool hasArrow;
  final bool hasDropdown;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => ListTile(
        leading: Icon(icon, color: const Color(0xFF1A1B1E), size: 22),
        title: Text(label,
            style: const TextStyle(fontSize: 15, color: Color(0xFF1A1B1E))),
        trailing: hasArrow
            ? const Icon(Icons.chevron_right, color: Color(0xFF929296))
            : hasDropdown
                ? const Icon(Icons.keyboard_arrow_down,
                    color: Color(0xFF929296))
                : null,
        onTap: onTap,
      );
}
