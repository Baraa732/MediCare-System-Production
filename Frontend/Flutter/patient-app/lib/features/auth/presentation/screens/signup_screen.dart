import 'package:cms/core/constants/assets.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/constants/syrian_governorates.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/core/widgets/custom_text_feild.dart';
import 'package:cms/features/auth/domain/otp_session.dart';
import 'package:cms/features/auth/presentation/cubit/signup_cubit.dart';
import 'package:cms/features/auth/presentation/cubit/signup_state.dart';
import 'package:cms/features/auth/presentation/screens/otp_screen.dart';
import 'package:cms/injection_container.dart';
import 'package:cms/core/animations/app_page_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

class SignupScreen extends StatelessWidget {
  const SignupScreen({super.key});
  static const String routeName = '/signup';

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => getIt<SignupCubit>(),
      child: const _SignupView(),
    );
  }
}

class _SignupView extends StatelessWidget {
  const _SignupView();

  @override
  Widget build(BuildContext context) {
    return BlocListener<SignupCubit, SignupState>(
      listener: (context, state) {
        if (state.shouldNavigateToOtp) {
          Navigator.push(
            context,
            AppPageRoute(
              builder: (_) => OtpScreen(
                phoneNumber: state.phoneNumber,
                mode: OtpMode.signupVerify,
              ),
            ),
          );
          context.read<SignupCubit>().resetNavigation();
        }
        if (state.errorMessage != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(state.errorMessage!)),
          );
          context.read<SignupCubit>().resetNavigation();
        }
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: BlocBuilder<SignupCubit, SignupState>(
            builder: (context, state) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _SignupHeader(state: state),
                  _StepProgress(state: state),
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 250),
                        child: _buildStepContent(context, state),
                      ),
                    ),
                  ),
                  _SignupFooter(state: state),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildStepContent(BuildContext context, SignupState state) {
    switch (state.currentStep) {
      case SignupStep.personal:
        return _PersonalStep(key: const ValueKey('personal'), state: state);
      case SignupStep.contact:
        return _ContactStep(key: const ValueKey('contact'), state: state);
      case SignupStep.security:
        return _SecurityStep(key: const ValueKey('security'), state: state);
    }
  }
}

class _SignupHeader extends StatelessWidget {
  const _SignupHeader({required this.state});

  final SignupState state;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<SignupCubit>();
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 20, 0),
      child: Row(
        children: [
          IconButton(
            onPressed: () {
              if (state.currentStep == SignupStep.personal) {
                Navigator.pop(context);
              } else {
                cubit.goToPreviousStep();
              }
            },
            icon: const Icon(Icons.arrow_back),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Create your account',
                  style: FontHeading.heading2.copyWith(color: AppColors.black),
                ),
                const SizedBox(height: 4),
                Text(
                  _stepSubtitle(state.currentStep),
                  style: FontHeading.body.copyWith(color: AppColors.customGray),
                ),
              ],
            ),
          ),
          Image.asset(Assets.assetsImagesCrossBlue, height: 36, width: 36),
        ],
      ),
    );
  }

  String _stepSubtitle(SignupStep step) {
    switch (step) {
      case SignupStep.personal:
        return 'Tell us about yourself';
      case SignupStep.contact:
        return 'How can we reach you?';
      case SignupStep.security:
        return 'Secure your account';
    }
  }
}

class _StepProgress extends StatelessWidget {
  const _StepProgress({required this.state});

  final SignupState state;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: List.generate(state.totalSteps, (index) {
              final active = index <= state.stepIndex;
              return Expanded(
                child: Container(
                  margin: EdgeInsets.only(right: index < state.totalSteps - 1 ? 8 : 0),
                  height: 4,
                  decoration: BoxDecoration(
                    color: active
                        ? AppColors.main_background_blue
                        : AppColors.main_background_blue.withOpacity( 0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 8),
          Text(
            'Step ${state.stepIndex + 1} of ${state.totalSteps}',
            style: FontHeading.bodySmall.copyWith(
              color: AppColors.main_background_blue,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _SignupFooter extends StatelessWidget {
  const _SignupFooter({required this.state});

  final SignupState state;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<SignupCubit>();
    final isLastStep = state.currentStep == SignupStep.security;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton(
          onPressed: state.isLoading
              ? null
              : () async {
                  if (isLastStep) {
                    await cubit.submitSignup();
                  } else {
                    cubit.goToNextStep();
                  }
                },
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.main_background_blue,
            disabledBackgroundColor:
                AppColors.main_background_blue.withOpacity( 0.25),
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          child: state.isLoading
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : Text(
                  isLastStep ? 'Create account & verify phone' : 'Continue',
                  style: FontHeading.button,
                ),
        ),
      ),
    );
  }
}

class _PersonalStep extends StatelessWidget {
  const _PersonalStep({super.key, required this.state});

  final SignupState state;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<SignupCubit>();
    final dobLabel = state.dateOfBirth != null
        ? DateFormat('dd MMM yyyy').format(state.dateOfBirth!)
        : 'Select date of birth';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionTitle(
          title: 'Personal information',
          subtitle: 'Used for your medical profile and appointment records.',
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: CustomTextField(
                label: 'First name',
                hint: 'First name',
                prefixIcon: Icons.person_outline,
                errorText: state.firstNameError,
                onChanged: cubit.onFirstNameChanged,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: CustomTextField(
                label: 'Last name',
                hint: 'Last name',
                prefixIcon: Icons.person_outline,
                errorText: state.lastNameError,
                onChanged: cubit.onLastNameChanged,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        _FieldLabel('Gender', required: true),
        const SizedBox(height: 8),
        _GenderSelector(
          value: state.gender.isEmpty ? null : state.gender,
          error: state.genderError,
          onChanged: cubit.onGenderChanged,
        ),
        const SizedBox(height: 16),
        _FieldLabel('Date of birth', required: true),
        const SizedBox(height: 8),
        _SelectableField(
          icon: Icons.calendar_today_outlined,
          label: dobLabel,
          hasValue: state.dateOfBirth != null,
          error: state.dobError,
          onTap: () => _pickDate(context, cubit, state.dateOfBirth),
          onClear: state.dateOfBirth != null ? cubit.clearDateOfBirth : null,
        ),
      ],
    );
  }

  Future<void> _pickDate(
    BuildContext context,
    SignupCubit cubit,
    DateTime? current,
  ) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: current ?? DateTime(now.year - 25, now.month, now.day),
      firstDate: DateTime(now.year - 120),
      lastDate: DateTime(now.year - 13, now.month, now.day),
      helpText: 'Select your date of birth',
    );
    if (picked != null && context.mounted) {
      cubit.onDateOfBirthChanged(picked);
    }
  }
}

class _ContactStep extends StatelessWidget {
  const _ContactStep({super.key, required this.state});

  final SignupState state;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<SignupCubit>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionTitle(
          title: 'Contact details',
          subtitle:
              'Your phone will be verified by OTP. Email and region are optional.',
        ),
        const SizedBox(height: 20),
        CustomTextField(
          label: 'Mobile number',
          hint: '09XX XXX XXXX',
          prefixIcon: Icons.phone_outlined,
          keyboardType: TextInputType.phone,
          isPhoneNumber: true,
          errorText: state.phoneError,
          onChanged: cubit.onPhoneChanged,
        ),
        const SizedBox(height: 12),
        CustomTextField(
          label: 'Email (optional)',
          hint: 'name@example.com',
          prefixIcon: Icons.email_outlined,
          keyboardType: TextInputType.emailAddress,
          errorText: state.emailError,
          onChanged: cubit.onEmailChanged,
        ),
        const SizedBox(height: 16),
        _FieldLabel('Governorate (optional)'),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          value: state.governorate.isEmpty ? null : state.governorate,
          isExpanded: true,
          decoration: InputDecoration(
            prefixIcon: const Icon(Icons.location_on_outlined,
                color: AppColors.customGray),
            hintText: 'Select your governorate',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          ),
          items: syrianGovernorates
              .map((g) => DropdownMenuItem(value: g, child: Text(g)))
              .toList(),
          onChanged: cubit.onGovernorateChanged,
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.main_background_blue.withOpacity( 0.08),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Icon(Icons.info_outline,
                  color: AppColors.main_background_blue, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Verification code will be sent via WhatsApp to your mobile number.',
                  style: FontHeading.bodySmall.copyWith(
                    color: AppColors.CustomgrayDark,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SecurityStep extends StatelessWidget {
  const _SecurityStep({super.key, required this.state});

  final SignupState state;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<SignupCubit>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionTitle(
          title: 'Account security',
          subtitle:
              'Choose a strong password. MediCare requires uppercase, lowercase, number, and special character.',
        ),
        const SizedBox(height: 20),
        CustomTextField(
          label: 'Password',
          hint: 'Create a strong password',
          prefixIcon: Icons.lock_outlined,
          obscureText: !state.isPasswordVisible,
          errorText: state.passwordError,
          suffixIcon: IconButton(
            icon: Icon(
              state.isPasswordVisible
                  ? Icons.visibility_outlined
                  : Icons.visibility_off_outlined,
              color: AppColors.customGray,
            ),
            onPressed: cubit.togglePasswordVisibility,
          ),
          onChanged: cubit.onPasswordChanged,
        ),
        const SizedBox(height: 12),
        CustomTextField(
          label: 'Confirm password',
          hint: 'Re-enter your password',
          prefixIcon: Icons.lock_outlined,
          obscureText: !state.isConfirmPasswordVisible,
          errorText: state.confirmPasswordError,
          suffixIcon: IconButton(
            icon: Icon(
              state.isConfirmPasswordVisible
                  ? Icons.visibility_outlined
                  : Icons.visibility_off_outlined,
              color: AppColors.customGray,
            ),
            onPressed: cubit.toggleConfirmPasswordVisibility,
          ),
          onChanged: cubit.onConfirmPasswordChanged,
        ),
        const SizedBox(height: 16),
        _PasswordRules(state: state),
        const SizedBox(height: 16),
        CheckboxListTile(
          value: state.acceptedTerms,
          onChanged: (v) => cubit.onTermsChanged(v ?? false),
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          title: Text(
            'I agree to the Terms of Service and Privacy Policy',
            style: FontHeading.bodySmall.copyWith(color: AppColors.grayDark),
          ),
          subtitle: state.termsError != null
              ? Text(
                  state.termsError!,
                  style: const TextStyle(color: Colors.red, fontSize: 12),
                )
              : null,
          activeColor: AppColors.main_background_blue,
        ),
      ],
    );
  }
}

class _PasswordRules extends StatelessWidget {
  const _PasswordRules({required this.state});

  final SignupState state;

  @override
  Widget build(BuildContext context) {
    final p = state.password;
    final rules = [
      ('At least 8 characters', p.length >= 8),
      ('One uppercase letter', RegExp(r'[A-Z]').hasMatch(p)),
      ('One lowercase letter', RegExp(r'[a-z]').hasMatch(p)),
      ('One number', RegExp(r'[0-9]').hasMatch(p)),
      ('One special character', RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(p)),
    ];

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.customGray.withOpacity( 0.4)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Password requirements',
            style: FontHeading.bodySmall.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          ...rules.map(
            (rule) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                children: [
                  Icon(
                    rule.$2 ? Icons.check_circle : Icons.circle_outlined,
                    size: 16,
                    color: rule.$2 ? AppColors.green : AppColors.customGray,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    rule.$1,
                    style: FontHeading.bodySmall.copyWith(
                      color: rule.$2 ? AppColors.green : AppColors.customGray,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: FontHeading.heading3.copyWith(color: AppColors.black)),
        const SizedBox(height: 6),
        Text(
          subtitle,
          style: FontHeading.body.copyWith(color: AppColors.customGray),
        ),
      ],
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text, {this.required = false});

  final String text;
  final bool required;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          text,
          style: FontHeading.bodySmall.copyWith(
            color: AppColors.grayDark,
            fontWeight: FontWeight.w500,
          ),
        ),
        if (required)
          const Text(' *', style: TextStyle(color: Colors.red, fontSize: 14)),
      ],
    );
  }
}

class _GenderSelector extends StatelessWidget {
  const _GenderSelector({
    required this.value,
    required this.onChanged,
    this.error,
  });

  final String? value;
  final ValueChanged<String> onChanged;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: _GenderChip(
              label: 'Male',
              selected: value == 'Male',
              onTap: () => onChanged('Male'),
            )),
            const SizedBox(width: 10),
            Expanded(child: _GenderChip(
              label: 'Female',
              selected: value == 'Female',
              onTap: () => onChanged('Female'),
            )),
            const SizedBox(width: 10),
            Expanded(child: _GenderChip(
              label: 'Other',
              selected: value == 'Other',
              onTap: () => onChanged('Other'),
            )),
          ],
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 6, left: 4),
            child: Text(error!, style: const TextStyle(color: Colors.red, fontSize: 12)),
          ),
      ],
    );
  }
}

class _GenderChip extends StatelessWidget {
  const _GenderChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.main_background_blue.withOpacity( 0.1)
              : Colors.white,
          border: Border.all(
            color: selected
                ? AppColors.main_background_blue
                : AppColors.customGray.withOpacity( 0.5),
            width: selected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(10),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: FontHeading.bodySmall.copyWith(
            color: selected ? AppColors.main_background_blue : AppColors.grayDark,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ),
    );
  }
}

class _SelectableField extends StatelessWidget {
  const _SelectableField({
    required this.icon,
    required this.label,
    required this.hasValue,
    required this.onTap,
    this.error,
    this.onClear,
  });

  final IconData icon;
  final String label;
  final bool hasValue;
  final VoidCallback onTap;
  final String? error;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    final borderColor = error != null ? Colors.red : AppColors.customGray;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            height: 56,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              border: Border.all(color: borderColor),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(icon, color: error != null ? Colors.red : AppColors.customGray, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: FontHeading.body.copyWith(
                      color: hasValue ? Colors.black : AppColors.customGray,
                    ),
                  ),
                ),
                if (onClear != null)
                  IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    color: AppColors.customGray,
                    onPressed: onClear,
                  ),
                const Icon(Icons.chevron_right, color: AppColors.customGray),
              ],
            ),
          ),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 4, left: 4),
            child: Text(error!, style: const TextStyle(color: Colors.red, fontSize: 12)),
          ),
      ],
    );
  }
}
