import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';

import '../constants/app_assets.dart';
import '../navigation/app_navigation.dart';
import '../widgets/common_widgets.dart';

Widget notificationButton({VoidCallback? onTap}) => GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Icon(Icons.notifications_outlined, color: Colors.white),
      ),
    );

Widget buildBlueHeader({
  String? backLabel,
  Widget? trailing,
  VoidCallback? onBack,
  VoidCallback? onNotificationTap,
  String? subtitle,
}) =>
    Container(
      color: const Color(0xFF0B74FA),
      padding: const EdgeInsets.only(top: 48, left: 16, right: 16, bottom: 16),
      child: Row(
        children: [
          if (backLabel != null) ...[
            GestureDetector(
              onTap: onBack,
              child: Row(
                children: [
                  const Icon(Icons.arrow_back, color: Colors.white, size: 20),
                  const SizedBox(width: 6),
                  Text(
                    backLabel,
                    style: const TextStyle(
                      fontSize: 16,
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const Spacer(),
          ] else ...[
            doctorAvatar(radius: 24, imageUrl: sessionStorage.avatarUrl),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Dr. ${sessionStorage.displayName}',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                  Text(
                    subtitle ?? 'Your clinic schedule',
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFFDBDBDC),
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (trailing != null)
            trailing
          else
            notificationButton(onTap: onNotificationTap),
        ],
      ),
    );

Widget buildTabs({required int activeTab, required BuildContext context}) =>
    Container(
      height: 40,
      decoration: BoxDecoration(
        color: const Color(0xFFF2F2F2),
        borderRadius: BorderRadius.circular(44),
      ),
      child: Row(
        children: [
          tabItem('Day', 0, Icons.view_list, activeTab,
              onTap: () => switchScheduleTab(context, activeTab, 0)),
          tabItem('Week', 1, Icons.grid_view, activeTab,
              onTap: () => switchScheduleTab(context, activeTab, 1)),
          tabItem('Month', 2, Icons.calendar_month_outlined, activeTab,
              onTap: () => switchScheduleTab(context, activeTab, 2)),
        ],
      ),
    );

Widget tabItem(String label, int index, IconData icon, int activeTab,
    {required VoidCallback onTap}) {
  final active = index == activeTab;
  return Expanded(
    child: GestureDetector(
      onTap: onTap,
      child: Container(
        height: 36,
        margin: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          color: active ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(44),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 14,
              color: active
                  ? const Color(0xFF1A1B1E)
                  : const Color(0xFF929296),
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                color: active
                    ? const Color(0xFF1A1B1E)
                    : const Color(0xFF929296),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

Widget buildBottomNav(int currentIndex, ValueChanged<int> onTap) =>
    BottomNavigationBar(
      currentIndex: currentIndex,
      onTap: onTap,
      selectedItemColor: const Color(0xFF0B74FA),
      unselectedItemColor: const Color(0xFF929296),
      type: BottomNavigationBarType.fixed,
      items: [
        BottomNavigationBarItem(
          icon: tabNavIcon(AppAssets.scheduleTab, selected: false),
          activeIcon: tabNavIcon(AppAssets.scheduleTab, selected: true),
          label: 'Schedule',
        ),
        BottomNavigationBarItem(
          icon: tabNavIcon(AppAssets.patientsTab, selected: false),
          activeIcon: tabNavIcon(AppAssets.patientsTab, selected: true),
          label: 'Patients',
        ),
        BottomNavigationBarItem(
          icon: tabNavIcon(AppAssets.shiftsTab, selected: false),
          activeIcon: tabNavIcon(AppAssets.shiftsTab, selected: true),
          label: 'Shifts',
        ),
        BottomNavigationBarItem(
          icon: tabNavIcon(AppAssets.settingsTab, selected: false),
          activeIcon: tabNavIcon(AppAssets.settingsTab, selected: true),
          label: 'Settings',
        ),
      ],
    );
