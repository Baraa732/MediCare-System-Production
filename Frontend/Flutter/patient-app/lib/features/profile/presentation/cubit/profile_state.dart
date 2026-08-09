class ProfileState {
  final bool isLoading;
  final String? errorMessage;
  final String fullName;
  final String phoneNumber;
  final String? email;
  final String? avatarUrl;
  final bool isSigningOut;

  const ProfileState({
    this.isLoading = false,
    this.errorMessage,
    this.fullName = '',
    this.phoneNumber = '',
    this.email,
    this.avatarUrl,
    this.isSigningOut = false,
  });

  ProfileState copyWith({
    bool? isLoading,
    String? errorMessage,
    String? fullName,
    String? phoneNumber,
    String? email,
    String? avatarUrl,
    bool? isSigningOut,
  }) {
    return ProfileState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      fullName: fullName ?? this.fullName,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      email: email ?? this.email,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      isSigningOut: isSigningOut ?? this.isSigningOut,
    );
  }
}
