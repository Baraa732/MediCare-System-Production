import 'package:cms/core/animations/fade_slide_in.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/entities/clinic.dart';
import 'package:cms/core/storage/saved_clinics_store.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/core/widgets/app_avatar.dart';
import 'package:cms/core/animations/app_page_route.dart';
import 'package:cms/core/widgets/modern_clinic_card.dart';
import 'package:cms/features/clinic/presentation/screens/clinic_detail_screen.dart';
import 'package:cms/features/emr/presentation/screens/emr_screen.dart';
import 'package:cms/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:cms/features/profile/presentation/cubit/profile_cubit.dart';
import 'package:cms/features/profile/presentation/cubit/profile_state.dart';
import 'package:cms/features/profile/presentation/screens/edit_profile_screen.dart';
import 'package:cms/injection_container.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class ProfileScreen extends StatefulWidget {
  static const routeName = '/profile';

  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  List<Clinic> _saved = [];

  @override
  void initState() {
    super.initState();
    _reloadSaved();
  }

  void _reloadSaved() {
    setState(() => _saved = getIt<SavedClinicsStore>().load());
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return BlocBuilder<ProfileCubit, ProfileState>(
      builder: (context, state) {
        return Scaffold(
          backgroundColor: const Color(0xFFF5F7FB),
          body: state.isLoading && state.fullName.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : FadeSlideIn(
                  child: RefreshIndicator(
                    color: AppColors.main_background_blue,
                    onRefresh: () async {
                      await context.read<ProfileCubit>().loadProfile();
                      _reloadSaved();
                    },
                    child: SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(
                        parent: BouncingScrollPhysics(),
                      ),
                      child: Column(
                        children: [
                          _Header(topInset: top, state: state),
                          Transform.translate(
                            offset: const Offset(0, -28),
                            child: Column(
                              children: [
                                _ProfileCard(state: state),
                                const SizedBox(height: 16),
                                _SavedSection(
                                  clinics: _saved,
                                  onChanged: _reloadSaved,
                                ),
                                const SizedBox(height: 8),
                                _SettingsGroup(
                                  title: 'Health',
                                  items: [
                                    _SettingItem(
                                      icon: Icons.folder_shared_outlined,
                                      label: 'My Health Record',
                                      subtitle: 'Allergies, meds, labs & visits',
                                      onTap: () => Navigator.pushNamed(
                                        context,
                                        EmrScreen.routeName,
                                      ),
                                    ),
                                  ],
                                ),
                                _SettingsGroup(
                                  title: 'Preferences',
                                  items: [
                                    _SettingItem(
                                      icon: Icons.notifications_active_outlined,
                                      label: 'Notifications',
                                      subtitle: 'Alerts & appointment updates',
                                      onTap: () => Navigator.pushNamed(
                                        context,
                                        NotificationsScreen.routeName,
                                      ),
                                    ),
                                    _SettingItem(
                                      icon: Icons.language_rounded,
                                      label: 'Language & region',
                                      subtitle: 'App language, formats',
                                      onTap: () => _toast(
                                        context,
                                        'Language settings coming soon',
                                      ),
                                    ),
                                    _SettingItem(
                                      icon: Icons.dark_mode_outlined,
                                      label: 'Appearance',
                                      subtitle: 'Theme and display',
                                      onTap: () => _toast(
                                        context,
                                        'Appearance settings coming soon',
                                      ),
                                    ),
                                  ],
                                ),
                                _SettingsGroup(
                                  title: 'Privacy & security',
                                  items: [
                                    _SettingItem(
                                      icon: Icons.lock_outline_rounded,
                                      label: 'Password & security',
                                      subtitle: 'Login protection',
                                      onTap: () => _toast(
                                        context,
                                        'Security settings coming soon',
                                      ),
                                    ),
                                    _SettingItem(
                                      icon: Icons.fingerprint_rounded,
                                      label: 'Biometric unlock',
                                      subtitle: 'Face / fingerprint',
                                      onTap: () => _toast(
                                        context,
                                        'Biometrics coming soon',
                                      ),
                                    ),
                                    _SettingItem(
                                      icon: Icons.shield_outlined,
                                      label: 'Privacy controls',
                                      subtitle: 'Data & permissions',
                                      onTap: () => _toast(
                                        context,
                                        'Privacy controls coming soon',
                                      ),
                                    ),
                                  ],
                                ),
                                _SettingsGroup(
                                  title: 'Advanced',
                                  items: [
                                    _SettingItem(
                                      icon: Icons.cloud_sync_outlined,
                                      label: 'Data & sync',
                                      subtitle: 'Offline cache, refresh',
                                      onTap: () => _toast(
                                        context,
                                        'Sync settings coming soon',
                                      ),
                                    ),
                                    _SettingItem(
                                      icon: Icons.storage_outlined,
                                      label: 'Storage & downloads',
                                      subtitle: 'Manage cached media',
                                      onTap: () => _toast(
                                        context,
                                        'Storage settings coming soon',
                                      ),
                                    ),
                                    _SettingItem(
                                      icon: Icons.bug_report_outlined,
                                      label: 'Diagnostics',
                                      subtitle: 'App version & logs',
                                      onTap: () => _toast(
                                        context,
                                        'MediCare Patient v1.0.0',
                                      ),
                                    ),
                                  ],
                                ),
                                _SettingsGroup(
                                  title: 'Support',
                                  items: [
                                    _SettingItem(
                                      icon: Icons.help_outline_rounded,
                                      label: 'Help Center',
                                      subtitle: 'FAQs and guides',
                                      onTap: () =>
                                          _toast(context, 'Help Center'),
                                    ),
                                    _SettingItem(
                                      icon: Icons.info_outline_rounded,
                                      label: 'About MediCare',
                                      subtitle: 'Terms & privacy policy',
                                      onTap: () =>
                                          _toast(context, 'About MediCare'),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                _SignOutButton(state: state),
                                const SizedBox(height: 36),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
        );
      },
    );
  }

  void _toast(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.topInset, required this.state});
  final double topInset;
  final ProfileState state;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(20, topInset + 16, 16, 48),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF0B74FA), Color(0xFF0858C7)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(30),
          bottomRight: Radius.circular(30),
        ),
      ),
      child: Row(
        children: [
          Text(
            'Profile',
            style: FontHeading.heading1.copyWith(
              color: Colors.white,
              fontSize: 26,
            ),
          ),
          const Spacer(),
          IconButton(
            onPressed: () =>
                Navigator.pushNamed(context, NotificationsScreen.routeName),
            icon: const Icon(
              Icons.notifications_none_rounded,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({required this.state});
  final ProfileState state;

  @override
  Widget build(BuildContext context) {
    final name = state.fullName.trim().isNotEmpty ? state.fullName : 'Patient';
    final phone =
        state.phoneNumber.trim().isNotEmpty ? state.phoneNumber : '—';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(26),
          topRight: Radius.circular(12),
          bottomLeft: Radius.circular(12),
          bottomRight: Radius.circular(26),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: AppColors.main_background_blue.withValues(alpha: 0.35),
                width: 2,
              ),
            ),
            child: AppAvatar(imageUrl: state.avatarUrl, radius: 30),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: FontHeading.heading4,
                ),
                const SizedBox(height: 4),
                Text(
                  phone,
                  style: FontHeading.bodySmall.copyWith(
                    color: AppColors.CustomgrayDark,
                  ),
                ),
              ],
            ),
          ),
          FilledButton.tonal(
            onPressed: () async {
              await Navigator.pushNamed(context, EditProfileScreen.routeName);
              if (context.mounted) {
                context.read<ProfileCubit>().loadProfile();
              }
            },
            style: FilledButton.styleFrom(
              backgroundColor:
                  AppColors.main_background_blue.withValues(alpha: 0.12),
              foregroundColor: AppColors.main_background_blue,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: const Text('Edit'),
          ),
        ],
      ),
    );
  }
}

class _SavedSection extends StatelessWidget {
  const _SavedSection({required this.clinics, required this.onChanged});
  final List<Clinic> clinics;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
          child: Row(
            children: [
              Text('Saved', style: FontHeading.heading4),
              const Spacer(),
              Text(
                '${clinics.length}',
                style: FontHeading.bodySmall.copyWith(
                  color: AppColors.customGray,
                ),
              ),
            ],
          ),
        ),
        if (clinics.isEmpty)
          Container(
            width: double.infinity,
            margin: const EdgeInsets.symmetric(horizontal: 16),
            padding: const EdgeInsets.all(18),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(22),
                topRight: Radius.circular(10),
                bottomLeft: Radius.circular(10),
                bottomRight: Radius.circular(22),
              ),
            ),
            child: Text(
              'Bookmark clinics to find them here quickly.',
              style: FontHeading.bodySmall.copyWith(
                color: AppColors.CustomgrayDark,
              ),
            ),
          )
        else
          SizedBox(
            height: 210,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: clinics.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (context, index) {
                final clinic = clinics[index];
                return ModernClinicCard(
                  clinic: clinic,
                  style: ModernClinicCardStyle.compact,
                  width: 168,
                  onTap: () async {
                    await Navigator.push(
                      context,
                      AppPageRoute(
                        builder: (_) => ClinicDetailScreen(clinic: clinic),
                      ),
                    );
                    onChanged();
                  },
                );
              },
            ),
          ),
        // Refresh bookmarks after returning from detail (bookmark toggle)
        if (clinics.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: TextButton(
              onPressed: onChanged,
              child: const Text('Refresh saved'),
            ),
          ),
      ],
    );
  }
}

class _SettingItem {
  const _SettingItem({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String subtitle;
  final VoidCallback onTap;
}

class _SettingsGroup extends StatelessWidget {
  const _SettingsGroup({required this.title, required this.items});
  final String title;
  final List<_SettingItem> items;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 8, bottom: 8),
            child: Text(
              title,
              style: FontHeading.bodySmall.copyWith(
                color: AppColors.CustomgrayDark,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(22),
                topRight: Radius.circular(10),
                bottomLeft: Radius.circular(10),
                bottomRight: Radius.circular(22),
              ),
            ),
            child: Column(
              children: [
                for (var i = 0; i < items.length; i++) ...[
                  ListTile(
                    onTap: items[i].onTap,
                    leading: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.main_background_blue
                            .withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        items[i].icon,
                        color: AppColors.main_background_blue,
                        size: 20,
                      ),
                    ),
                    title: Text(
                      items[i].label,
                      style: FontHeading.body.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    subtitle: Text(
                      items[i].subtitle,
                      style: FontHeading.caption.copyWith(
                        color: AppColors.customGray,
                      ),
                    ),
                    trailing: const Icon(
                      Icons.chevron_right_rounded,
                      color: AppColors.customGray,
                    ),
                  ),
                  if (i != items.length - 1)
                    Divider(
                      height: 1,
                      indent: 68,
                      color: Colors.grey.shade100,
                    ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SignOutButton extends StatelessWidget {
  const _SignOutButton({required this.state});
  final ProfileState state;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed: state.isSigningOut
              ? null
              : () => _showSignOutDialog(context),
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.red.shade50,
            foregroundColor: Colors.red,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.logout_rounded, size: 20),
              const SizedBox(width: 8),
              Text(
                'Sign out',
                style: FontHeading.button.copyWith(color: Colors.red),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showSignOutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text('Sign out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(dialogContext);
              final signedOut =
                  await context.read<ProfileCubit>().signOut();
              if (signedOut && context.mounted) {
                Navigator.pushNamedAndRemoveUntil(
                  context,
                  '/welcome',
                  (_) => false,
                );
              }
            },
            child: const Text(
              'Sign out',
              style: TextStyle(color: Colors.red),
            ),
          ),
        ],
      ),
    );
  }
}
