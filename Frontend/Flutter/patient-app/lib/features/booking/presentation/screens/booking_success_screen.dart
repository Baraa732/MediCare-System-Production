import 'package:cms/core/animations/app_lottie.dart';
import 'package:cms/core/animations/fade_slide_in.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/features/home/presentation/screens/home_screen.dart';
import 'package:flutter/material.dart';

class BookingSuccessScreen extends StatelessWidget {
  static const routeName = '/booking-success';

  const BookingSuccessScreen({super.key});

  void _goHome(BuildContext context, {int tab = 0}) {
    Navigator.pushNamedAndRemoveUntil(
      context,
      HomeScreen.routeName,
      (route) => false,
      arguments: tab,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.lightGray,
      body: Column(
        children: [
          _buildBlueHeader(context),
          Expanded(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: FadeSlideIn(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const AppLottie.asset(
                        asset: AppLottieAssets.success,
                        height: 140,
                        repeat: false,
                        fallbackIcon: Icons.check_circle_rounded,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Request Submitted',
                        style: FontHeading.heading1.copyWith(
                          color: Colors.black,
                          fontSize: 24,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'You will receive a notification once the clinic confirms your appointment time',
                        style: FontHeading.body.copyWith(
                          color: AppColors.CustomgrayDark,
                          fontSize: 16,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 32),
                      Text(
                        'Pending Review',
                        style: FontHeading.body.copyWith(
                          color: AppColors.orange,
                          fontWeight: FontWeight.w600,
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          _buildBottomButtons(context),
        ],
      ),
    );
  }

  Widget _buildBlueHeader(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.main_background_blue,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(24),
          bottomRight: Radius.circular(24),
        ),
      ),
      padding: EdgeInsets.fromLTRB(
        16,
        MediaQuery.paddingOf(context).top + 12,
        16,
        20,
      ),
      child: Row(
        children: [
          Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            child: InkWell(
              borderRadius: BorderRadius.circular(24),
              onTap: () => _goHome(context),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    const Icon(Icons.arrow_back, color: Colors.black, size: 16),
                    const SizedBox(width: 4),
                    Text(
                      'Back to home',
                      style: FontHeading.bodySmall.copyWith(
                        color: Colors.black,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const Spacer(),
          Text(
            'Booking successful',
            style: FontHeading.heading4.copyWith(
              color: Colors.white,
              fontSize: 18,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomButtons(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        16,
        16,
        16 + MediaQuery.paddingOf(context).bottom,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.grey.shade200,
            blurRadius: 8,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () => _goHome(context, tab: 3),
              icon: const Icon(
                Icons.calendar_today,
                color: Colors.white,
                size: 20,
              ),
              label: const Text(
                'View my appointments',
                style: FontHeading.button,
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.main_background_blue,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => _goHome(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.main_background_blue.withValues(
                  alpha: 0.1,
                ),
                foregroundColor: AppColors.main_background_blue,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                shadowColor: Colors.transparent,
              ),
              child: Text(
                'Back to Home',
                style: FontHeading.button.copyWith(
                  color: AppColors.main_background_blue,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
