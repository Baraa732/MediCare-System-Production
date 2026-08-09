import 'package:cms/core/constants/assets.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/core/widgets/page_indicator.dart';
import 'package:cms/features/auth/data/data_sources/local/auth_local_data_source.dart';
import 'package:flutter/material.dart';

class OnBordingScreen extends StatelessWidget {
  static const routeName = "/onbording";

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      bottomSheet: BottomSheet(
        enableDrag: false,
        onClosing: () {},
        builder: (context) {
          return Container(
            height: 140,
            width: double.infinity,
            decoration: const BoxDecoration(
              color: AppColors.main_background_white,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(44),
                topRight: Radius.circular(44),
              ),
            ),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 10, left: 20, right: 20),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      IconButton(
                        onPressed: () {},
                        icon: const Icon(Icons.arrow_back),
                        color: AppColors.main_background_blue,
                        style: IconButton.styleFrom(
                          backgroundColor: AppColors.main_background_blue
                              .withOpacity(0.1),
                          shape: const CircleBorder(),
                          fixedSize: const Size(40, 40),
                        ),
                      ),
                      PageIndicator(
                        currentPage: 1,
                        totalPages: 3,
                        dotSize: 8,
                        selectedDotSize: 12,
                      ),
                      IconButton(
                        onPressed: () {},
                        icon: const Icon(Icons.arrow_forward),
                        color: AppColors.main_background_white,
                        style: IconButton.styleFrom(
                          backgroundColor: AppColors.main_background_blue,
                          shape: const CircleBorder(),
                          fixedSize: const Size(40, 40),
                        ),
                      ),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: () async {
                    final localDataSource = AuthLocalDataSource();
                    await localDataSource.setOnboardingCompleted();

                    Navigator.pushNamedAndRemoveUntil(
                      context,
                      '/welcome',
                      (route) => false,
                    );
                  },
                  child: Text(
                    "Skip",
                    style: FontHeading.button.copyWith(
                      color: AppColors.main_background_blue,
                      decoration: TextDecoration.underline,
                      decorationColor: AppColors.main_background_blue,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
      backgroundColor: AppColors.main_background_blue,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 24, right: 24, top: 24),
            child: Column(
              children: [
                const SizedBox(height: 10),
                Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      child: Image.asset(Assets.assetsImagesCross),
                    ),
                    const Spacer(),
                  ],
                ),
                const SizedBox(height: 24),
                Text(
                  "Every doctor you need in one place",
                  style: FontHeading.heading1,
                ),
                const SizedBox(height: 4),
                Text(
                  "Some splash text in here depending on what we decide later",
                  style: FontHeading.bodyLarge,
                ),
              ],
            ),
          ),
          Expanded(
            child: Align(
              alignment: Alignment.topCenter,
              child: Transform.translate(
                offset: const Offset(0, -50),
                child: Image.asset(
                  Assets.assetsImagesDoctorImg,
                  fit: BoxFit.fill,
                  width: double.infinity,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
