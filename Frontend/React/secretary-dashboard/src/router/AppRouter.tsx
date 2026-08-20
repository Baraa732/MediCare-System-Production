import React from "react";
import {
  WithCarouselCard,
  WithoutCarouselCard,
} from "@/features/auth/components";
import {
  SignInForm,
  ConfirmEmailForm,
  LinkExpiredForm,
  ResetPasswordForm,
  ResetSuccessForm,
  ForgotPasswordForm,
  ForgotPasswordCheckPhoneForm,
  ForgotPasswordVerifyForm,
} from "@/features/auth/components/Forms";
import DashboardPage from "@/features/dashboardAssitant";
import { ProfileSettingsPage } from "@/features/settings/ProfileSettingsPage";
import { NotificationsPage } from "@/features/notifications/NotificationsPage";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { GuestRoute, ProtectedRoute } from "./ProtectedRoute";
import { sendPasswordResetOtp } from "@/lib/api/auth";
import { normalizeCaughtError } from "@/lib/api/errors";
import { useAuthStore } from "@/stores/authStore";

export default function AppRouter() {
  return (
    <Routes>
      <Route index element={<Navigate to="/auth/login" replace />} />

      <Route path="CMS_Project/*" element={<LegacyPathRedirect />} />

      <Route
        element={
          <GuestRoute>
            <WithCarouselCard />
          </GuestRoute>
        }
      >
        <Route path="auth" element={<Navigate to="/auth/login" replace />} />
        <Route path="auth/login" element={<SignInForm />} />
        <Route path="auth/otp" element={<ConfirmEmailForm />} />
        <Route path="auth/forget_password" element={<ForgotPasswordView />} />
        <Route path="auth/forget_password/check_phone" element={<ForgotPasswordCheckPhoneForm />} />
        <Route path="auth/forget_password/verify" element={<ForgotPasswordVerifyForm />} />
      </Route>

      <Route
        element={
          <GuestRoute>
            <WithoutCarouselCard />
          </GuestRoute>
        }
      >
        <Route path="auth/link_expired" element={<LinkExpiredForm />} />
        <Route path="auth/reset_password" element={<ResetPasswordForm />} />
        <Route path="auth/reset_success" element={<ResetSuccessForm />} />
      </Route>

      <Route
        path="dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="dashboard/notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="dashboard/settings"
        element={
          <ProtectedRoute>
            <ProfileSettingsPage />
          </ProtectedRoute>
        }
      />

      <Route path="test" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  );
}

function LegacyPathRedirect() {
  const location = useLocation();
  const stripped = location.pathname.replace(/^\/CMS_Project/, "") || "/auth/login";

  return (
    <Navigate
      to={`${stripped}${location.search}${location.hash}`}
      replace
    />
  );
}

function ForgotPasswordView() {
  const navigate = useNavigate();
  const setPasswordResetPhone = useAuthStore((s) => s.setPasswordResetPhone);
  const markPasswordResetOtpSent = useAuthStore((s) => s.markPasswordResetOtpSent);
  const logout = useAuthStore((s) => s.logout);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    // Clear any stale JWT so guest password-reset calls are not treated as authenticated.
    logout();
  }, [logout]);

  const handleSendResetCode = async (phoneNumber: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await sendPasswordResetOtp(phoneNumber);
      setPasswordResetPhone(phoneNumber);
      markPasswordResetOtpSent();
      if (res.devOtp) {
        console.info(`[dev] Password reset OTP: ${res.devOtp}`);
      }
      navigate("/auth/forget_password/check_phone", { replace: true });
    } catch (err) {
      setErrorMessage(
        normalizeCaughtError(
          err,
          "Could not send verification code. Check the phone number and try again.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ForgotPasswordForm
      onSendResetCode={handleSendResetCode}
      isLoading={isSubmitting}
      errorMessage={errorMessage}
    />
  );
}
