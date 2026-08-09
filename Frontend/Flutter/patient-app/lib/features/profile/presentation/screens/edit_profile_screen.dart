import 'package:cms/core/constants/assets.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/constants/responsive_constants.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/core/widgets/custom_text_feild.dart';
import 'package:cms/features/profile/presentation/cubit/edit_profile_cubit.dart';
import 'package:cms/features/profile/presentation/cubit/edit_profile_state.dart';
import 'package:cms/injection_container.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class EditProfileScreen extends StatelessWidget {
  static const routeName = '/edit-profile';

  const EditProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final responsive = ResponsiveConstants.fromContext(context);
    return BlocProvider(
      create: (context) => getIt<EditProfileCubit>(),
      child: Scaffold(
        backgroundColor: Colors.white,
        resizeToAvoidBottomInset: true,
        body: SafeArea(
          child: BlocBuilder<EditProfileCubit, EditProfileState>(
            builder: (context, state) {
              return SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ---- Blue Header (Back + Title) ----
                    _buildHeader(context),
                    const SizedBox(height: 16),
                    // ---- Top Text ----
                    _buildTopText(context),
                    const SizedBox(height: 24),
                    // ---- Avatar (with camera icon) ----
                    _buildAvatar(context, state),
                    const SizedBox(height: 32),
                    // ---- Full Name Field + Phone Number Field ----
                    _buildTextFields(context, state),
                    SizedBox(height: responsive.betweenFieldAndButtonProfile),
                    // ---- Save Changes Button ----
                    _buildSaveButton(context, state),
                    const SizedBox(height: 24),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  // ============================================================
  //  BLUE HEADER (Back + Title)
  // ============================================================
  Widget _buildHeader(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
              decoration: BoxDecoration(
                color: AppColors.main_background_white,
                borderRadius: BorderRadius.circular(117),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.arrow_back, color: AppColors.black, size: 16),
                  const SizedBox(width: 4),
                  Text(
                    'Back',
                    style: FontHeading.bodySmall.copyWith(
                      color: AppColors.black,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const Spacer(),
        ],
      ),
    );
  }

  // ============================================================
  //  AVATAR (with camera icon)
  // ============================================================
  Widget _buildAvatar(BuildContext context, EditProfileState state) {
    return Center(
      child: GestureDetector(
        onTap: () {
          context.read<EditProfileCubit>().pickProfileImage();
        },
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 92,
              height: 92,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.customGray,
                image: state.profileImage != null
                    ? DecorationImage(
                        image: FileImage(state.profileImage!),
                        fit: BoxFit.cover,
                      )
                    : DecorationImage(
                        image: AssetImage(Assets.assetsImagesUserFolanAlfolani),
                        fit: BoxFit.cover,
                      ),
              ),
            ),
            Positioned(
              bottom: -2,
              right: -2,
              child: Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.main_background_blue,
                  border: Border.all(color: Colors.white, width: 2),
                ),
                child: const Icon(
                  Icons.add_a_photo,
                  color: Colors.white,
                  size: 16,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ============================================================
  //  FULL NAME FIELD + PHONE NUMBER FIELD
  // ============================================================
  Widget _buildTextFields(BuildContext context, EditProfileState state) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CustomTextField(
          label: 'Full name',
          hint: 'Enter your full name',
          prefixIcon: Icons.person_outline,
          keyboardType: TextInputType.name,
          controller: TextEditingController(text: state.fullName),
          onChanged: (value) {
            context.read<EditProfileCubit>().onNameChanged(value);
          },
        ),
        const SizedBox(height: 16),
        CustomTextField(
          label: 'Phone number',
          hint: '09XX XXXX XXX',
          prefixIcon: Icons.phone_outlined,
          keyboardType: TextInputType.phone,
          isPhoneNumber: true,
          controller: TextEditingController(text: state.phoneNumber),
          onChanged: (value) {
            context.read<EditProfileCubit>().onPhoneChanged(value);
          },
        ),
      ],
    );
  }

  // ============================================================
  //  SAVE CHANGES BUTTON
  // ============================================================
  Widget _buildSaveButton(BuildContext context, EditProfileState state) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: state.isValid && !state.isLoading
            ? () {
                context.read<EditProfileCubit>().saveProfile();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Profile updated successfully!'),
                    backgroundColor: AppColors.green,
                  ),
                );
                // Optionally navigate back after a delay
                Future.delayed(const Duration(milliseconds: 500), () {
                  Navigator.pop(context);
                });
              }
            : null,
        style: ElevatedButton.styleFrom(
          disabledBackgroundColor: AppColors.main_background_blue.withOpacity(
            0.2,
          ),
          backgroundColor: AppColors.main_background_blue,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        child: state.isLoading
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : const Text('Save changes', style: FontHeading.button),
      ),
    );
  }

  _buildTopText(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(40, 0, 40, 0),
      child: Column(
        children: [
          // ---- Title ----
          Text(
            'Edit your profile',
            style: FontHeading.heading1.copyWith(
              color: Colors.black,
              fontSize: 18,
            ),
          ),
          // ---- Subtitle ----
          Text(
            'Edit your profile informations',
            style: FontHeading.bodyLarge.copyWith(
              color: AppColors.CustomgrayDark,
            ),
          ),
        ],
      ),
    );
  }
}
