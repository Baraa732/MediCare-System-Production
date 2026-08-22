import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/constants/app_assets.dart';
import '../../core/layout/app_shell.dart';
import '../../core/navigation/app_navigation.dart';
import '../../core/utils/app_dialogs.dart';
import '../../core/widgets/common_widgets.dart';
import '../../core/widgets/language_selector.dart';
import '../auth/forgot_password_screen.dart';
import '../auth/login_screen.dart';
import 'edit_profile_screen.dart';
import 'profile_sheets.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen>
    with SingleTickerProviderStateMixin {
  final int _navIndex = 3;
  bool _loggingOut = false;
  late final AnimationController _shimmer;

  String? _specialty;
  String? _phone;
  String? _email;
  String? _clinicName;
  String? _firstName;
  String? _lastName;
  String? _avatarUrl;

  @override
  void initState() {
    super.initState();
    _shimmer = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2600),
    )..repeat();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      await authApi.refreshProfileNames();
      final map = await authApi.fetchOwnProfile();
      final clinicName = await scheduleApi.getClinicName();
      if (!mounted) return;
      setState(() {
        _firstName = map?['firstName']?.toString();
        _lastName = map?['lastName']?.toString();
        _specialty = map?['specialization']?.toString() ??
            map?['specialty']?.toString();
        _phone = map?['phoneNumber']?.toString() ?? map?['phone']?.toString();
        _email = map?['email']?.toString();
        _clinicName = clinicName;
        final profileData = map?['profileData'];
        _avatarUrl = map?['avatarUrl']?.toString() ??
            (profileData is Map
                ? profileData['avatarUrl']?.toString()
                : null);
      });
    } catch (_) {}
  }

  @override
  void dispose() {
    _shimmer.dispose();
    super.dispose();
  }

  Future<void> _signOut() async {
    if (_loggingOut) return;
    setState(() => _loggingOut = true);
    try {
      await authApi.logout();
      await pushNotificationService.onUserLoggedOut();
    } catch (_) {}
    if (!mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (r) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    final roleParts = <String>[
      if (_specialty != null && _specialty!.trim().isNotEmpty) _specialty!,
      if (_clinicName != null && _clinicName!.trim().isNotEmpty)
        _clinicName!
      else if (sessionStorage.clinicId != null)
        'Clinic doctor',
    ];
    final roleLine = roleParts.isEmpty
        ? (sessionStorage.clinicId == null ? 'Doctor account' : 'Clinic doctor')
        : roleParts.join(' · ');
    return Scaffold(
      backgroundColor: const Color(0xFFF2F2F2),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: EdgeInsets.fromLTRB(16, top + 12, 16, 22),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF0B74FA), Color(0xFF0A66DE)],
              ),
            ),
            child: Stack(
              children: [
                Positioned(
                  right: -30,
                  top: -20,
                  child: AnimatedBuilder(
                    animation: _shimmer,
                    builder: (_, __) => Transform.rotate(
                      angle: _shimmer.value * 0.4,
                      child: Container(
                        width: 140,
                        height: 140,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withValues(alpha: 0.08),
                        ),
                      ),
                    ),
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'Settings',
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                              letterSpacing: -0.4,
                            ),
                          ),
                        ),
                        notificationButton(
                          onTap: () => openNotifications(context),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.2),
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(3),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.5),
                              ),
                            ),
                            child: doctorAvatar(
                              radius: 26,
                              imageUrl: _avatarUrl,
                            ),
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
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    SvgPicture.asset(
                                      AppAssets.dentist,
                                      width: 12,
                                      height: 12,
                                      colorFilter: const ColorFilter.mode(
                                        Colors.white70,
                                        BlendMode.srcIn,
                                      ),
                                    ),
                                    const SizedBox(width: 5),
                                    Expanded(
                                      child: Text(
                                        roleLine,
                                        style: TextStyle(
                                          fontSize: 13,
                                          color: Colors.white
                                              .withValues(alpha: 0.85),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                if (_phone != null && _phone!.isNotEmpty)
                                  Text(
                                    _phone!,
                                    style: TextStyle(
                                      fontSize: 12,
                                      color:
                                          Colors.white.withValues(alpha: 0.75),
                                    ),
                                  ),
                                if (_email != null && _email!.isNotEmpty)
                                  Text(
                                    _email!,
                                    style: TextStyle(
                                      fontSize: 12,
                                      color:
                                          Colors.white.withValues(alpha: 0.75),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: const Text(
                              'Active',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                _sectionLabel('Workspace'),
                _settingsGroup([
                  _ModernSettingTile(
                    icon: Icons.person_outline_rounded,
                    accent: const Color(0xFF0B74FA),
                    label: 'Edit profile',
                    subtitle: 'Photo, name, email, and specialization',
                    onTap: () async {
                      final ok = await Navigator.push<bool>(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const EditDoctorProfileScreen(),
                        ),
                      );
                      if (ok == true) {
                        await _loadProfile();
                        if (context.mounted) {
                          showSnack(context, 'Profile updated');
                        }
                      }
                    },
                  ),
                  _ModernSettingTile(
                    icon: Icons.notifications_outlined,
                    accent: const Color(0xFF0B74FA),
                    label: 'Notifications',
                    subtitle: 'Alerts for visits and clinic updates',
                    onTap: () => openNotifications(context),
                  ),
                  _ModernSettingTile(
                    icon: Icons.translate_outlined,
                    accent: const Color(0xFF2E7D32),
                    label: 'App language',
                    subtitle: 'Choose your preferred language',
                    trailing: const Icon(Icons.keyboard_arrow_down_rounded,
                        color: Color(0xFF929296)),
                    onTap: () => showLanguagePicker(context),
                  ),
                  _ModernSettingTile(
                    icon: Icons.lock_outline_rounded,
                    accent: const Color(0xFFE65C00),
                    label: 'Change password',
                    subtitle: 'Update the password for this account',
                    onTap: () async {
                      final ok = await showChangePasswordSheet(context);
                      if (ok && context.mounted) {
                        showSnack(context, 'Password updated');
                      }
                    },
                  ),
                  _ModernSettingTile(
                    icon: Icons.lock_reset_rounded,
                    accent: const Color(0xFFE65C00),
                    label: 'Forgot password',
                    subtitle: 'Reset via WhatsApp OTP if you are locked out',
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const ForgotPasswordScreen(),
                      ),
                    ),
                  ),
                ]),
                const SizedBox(height: 18),
                _sectionLabel('Support'),
                _settingsGroup([
                  _ModernSettingTile(
                    icon: Icons.info_outline_rounded,
                    accent: const Color(0xFF5C6BC0),
                    label: 'About MediCare',
                    subtitle: 'Product story and clinic mission',
                    onTap: () => showAboutUsDialog(context),
                  ),
                  _ModernSettingTile(
                    icon: Icons.help_outline_rounded,
                    accent: const Color(0xFF00897B),
                    label: 'Help center & FAQ',
                    subtitle: 'Quick answers for daily workflows',
                    onTap: () => showHelpDialog(context),
                  ),
                  _ModernSettingTile(
                    icon: Icons.phone_in_talk_outlined,
                    accent: const Color(0xFF0B74FA),
                    label: 'Contact support',
                    subtitle: 'Reach the MediCare care team',
                    onTap: () => showContactDialog(context),
                  ),
                ]),
                const SizedBox(height: 22),
                Material(
                  color: const Color(0xFFFFF1F1),
                  borderRadius: BorderRadius.circular(16),
                  child: InkWell(
                    onTap: _loggingOut ? null : _signOut,
                    borderRadius: BorderRadius.circular(16),
                    child: SizedBox(
                      height: 54,
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
                            const Icon(Icons.logout_rounded,
                                color: Color(0xFFE53935), size: 20),
                            const SizedBox(width: 8),
                            const Text(
                              'Sign out',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFFE53935),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: buildBottomNav(
        _navIndex,
        (i) => switchMainTab(context, _navIndex, i),
      ),
    );
  }

  Widget _sectionLabel(String label) => Padding(
        padding: const EdgeInsets.only(bottom: 8, left: 4),
        child: Text(
          label.toUpperCase(),
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: Color(0xFF929296),
            letterSpacing: 0.8,
          ),
        ),
      );

  Widget _settingsGroup(List<Widget> items) => Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 14,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          children: [
            for (var i = 0; i < items.length; i++) ...[
              items[i],
              if (i < items.length - 1)
                const Divider(height: 1, indent: 68, endIndent: 16),
            ],
          ],
        ),
      );
}

class _ModernSettingTile extends StatelessWidget {
  const _ModernSettingTile({
    required this.icon,
    required this.accent,
    required this.label,
    required this.subtitle,
    required this.onTap,
    this.trailing,
  });

  final IconData icon;
  final Color accent;
  final String label;
  final String subtitle;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      leading: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: accent, size: 22),
      ),
      title: Text(
        label,
        style: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w700,
          color: Color(0xFF1A1B1E),
        ),
      ),
      subtitle: Text(
        subtitle,
        style: const TextStyle(fontSize: 12.5, color: Color(0xFF929296)),
      ),
      trailing: trailing ??
          const Icon(Icons.chevron_right_rounded, color: Color(0xFF929296)),
      onTap: onTap,
    );
  }
}
