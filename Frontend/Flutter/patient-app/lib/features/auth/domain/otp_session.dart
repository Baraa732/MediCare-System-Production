enum OtpMode {
  loginMfa,
  signupVerify,
  forgotPassword,
}

class OtpSession {
  final String phoneNumber;
  final OtpMode mode;
  final String? mfaToken;

  const OtpSession({
    required this.phoneNumber,
    required this.mode,
    this.mfaToken,
  });
}
