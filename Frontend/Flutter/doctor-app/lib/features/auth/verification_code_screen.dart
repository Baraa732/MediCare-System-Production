import 'dart:async';

import 'package:cms_doctor_app/features/auth/no_clinic_access_screen.dart';
import 'package:cms_doctor_app/features/schedule/day_view_screen.dart';
import 'package:cms_doctor_app/injection.dart';
import 'package:flutter/material.dart';

import '../../core/constants/app_assets.dart';
import '../../core/navigation/app_navigation.dart';
import '../../core/widgets/common_widgets.dart';
import '../../core/widgets/language_selector.dart';

class VerificationCodeScreen extends StatefulWidget {
  const VerificationCodeScreen({
    super.key,
    required this.mfaToken,
    this.phoneNumber = '',
  });

  final String mfaToken;
  final String phoneNumber;

  @override
  State<VerificationCodeScreen> createState() => _VerificationCodeScreenState();
}

class _VerificationCodeScreenState extends State<VerificationCodeScreen> {
  final List<TextEditingController> _ctrls =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _nodes = List.generate(6, (_) => FocusNode());
  int _seconds = 60;
  Timer? _timer;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_seconds == 0) {
        t.cancel();
      } else {
        setState(() => _seconds--);
      }
    });
  }

  @override
  void dispose() {
    for (final c in _ctrls) {
      c.dispose();
    }
    for (final f in _nodes) {
      f.dispose();
    }
    _timer?.cancel();
    super.dispose();
  }

  String get _timerText {
    final m = _seconds ~/ 60;
    final s = _seconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  bool get _codeComplete => _ctrls.every((c) => c.text.trim().isNotEmpty);

  String get _otp => _ctrls.map((c) => c.text.trim()).join();

  Future<void> _confirmCode() async {
    if (!_codeComplete) {
      showSnack(context, 'Please enter the full 6-digit code');
      return;
    }
    setState(() => _loading = true);
    try {
      final session = await authApi.verifyMfa(
        mfaToken: widget.mfaToken,
        otp: _otp,
      );
      if (!mounted) return;
      if (session.clinicId == null || session.clinicId!.isEmpty) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const NoClinicAccessScreen()),
        );
        return;
      }
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const DayViewScreen()),
      );
    } catch (e) {
      if (!mounted) return;
      showSnack(context, e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              children: [
                const Align(
                  alignment: Alignment.centerRight,
                  child: Padding(
                    padding: EdgeInsets.only(top: 16),
                    child: LanguageSelector(),
                  ),
                ),
                const SizedBox(height: 24),
                appLogo(AppAssets.blueLogo, size: 72),
                const SizedBox(height: 28),
                const Text(
                  'Verification code',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1A1B1E),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  widget.phoneNumber.isEmpty
                      ? 'Enter the 6-digit code sent to your WhatsApp'
                      : 'Enter the code sent to ${widget.phoneNumber}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 15, color: Color(0xFF929296)),
                ),
                const SizedBox(height: 28),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: List.generate(6, (i) {
                    return SizedBox(
                      width: 44,
                      child: TextField(
                        controller: _ctrls[i],
                        focusNode: _nodes[i],
                        textAlign: TextAlign.center,
                        keyboardType: TextInputType.number,
                        maxLength: 1,
                        decoration: InputDecoration(
                          counterText: '',
                          border: inputBorder(const Color(0xFFB6B7B9)),
                          focusedBorder:
                              inputBorder(const Color(0xFF0B74FA), width: 2),
                        ),
                        onChanged: (v) {
                          if (v.isNotEmpty && i < 5) {
                            _nodes[i + 1].requestFocus();
                          }
                          if (v.isEmpty && i > 0) {
                            _nodes[i - 1].requestFocus();
                          }
                          setState(() {});
                        },
                      ),
                    );
                  }),
                ),
                const SizedBox(height: 16),
                Text(
                  _seconds > 0 ? 'Resend in $_timerText' : 'You can resend now',
                  style: const TextStyle(color: Color(0xFF929296)),
                ),
                const SizedBox(height: 40),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _loading || !_codeComplete ? null : _confirmCode,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0B74FA),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: _loading
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Confirm'),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}
