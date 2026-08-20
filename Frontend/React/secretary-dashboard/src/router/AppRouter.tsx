import React, { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { GuestRoute, ProtectedRoute } from "./ProtectedRoute";
import { RouteFallback } from "@/components/RouteFallback";
import { sendPasswordResetOtp } from "@/lib/api/auth";
import { normalizeCaughtError } from "@/lib/api/errors";
import { useAuthStore } from "@/stores/authStore";

const WithCarouselCard = lazy(() =>
  import("@/features/auth/components/WithCarouselCard"),
);
const WithoutCarouselCard = lazy(() =>
  import("@/features/auth/components/WithoutCarouselCard"),
);
const SignInForm = lazy(() =>
  import("@/features/auth/components/Forms/SignInForm").then((m) => ({
    default: m.SignInForm,
  })),
);
const ConfirmEmailForm = lazy(() =>
  import("@/features/auth/components/Forms/ConfirmEmailForm").then((m) => ({
    default: m.ConfirmEmailForm,
  })),
);
const LinkExpiredForm = lazy(() =>
  import("@/features/auth/components/Forms/LinkExpiredForm").then((m) => ({
    default: m.LinkExpiredForm,
  })),
);
const ResetPasswordForm = lazy(() =>
  import("@/features/auth/components/Forms/ResetPasswordForm").then((m) => ({
    default: m.ResetPasswordForm,
  })),
);
const ResetSuccessForm = lazy(() =>
  import("@/features/auth/components/Forms/ResetSuccessForm").then((m) => ({
    default: m.ResetSuccessForm,
  })),
);
const ForgotPasswordForm = lazy(() =>
  import("@/features/auth/components/Forms/ForgetPasswordForm").then((m) => ({
    default: m.ForgotPasswordForm,
  })),
);
const ForgotPasswordCheckPhoneForm = lazy(() =>
  import("@/features/auth/components/Forms/ForgotPasswordCheckPhoneForm").then(
    (m) => ({ default: m.ForgotPasswordCheckPhoneForm }),
  ),
);
const ForgotPasswordVerifyForm = lazy(() =>
  import("@/features/auth/components/Forms/ForgotPasswordVerifyForm").then(
    (m) => ({ default: m.ForgotPasswordVerifyForm }),
  ),
);
const DashboardPage = lazy(() => import("@/features/dashboardAssitant"));
const NotificationsPage = lazy(() =>
  import("@/features/notifications/NotificationsPage").then((m) => ({
    default: m.NotificationsPage,
  })),
);
const ProfileSettingsPage = lazy(() =>
  import("@/features/settings/ProfileSettingsPage").then((m) => ({
    default: m.ProfileSettingsPage,
  })),
);

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route index element={<Navigate to="/auth/login" replace />} />

      <Route path="CMS_Project/*" element={<LegacyPathRedirect />} />

      <Route
        element={
          <GuestRoute>
            <LazyPage>
              <WithCarouselCard />
            </LazyPage>
          </GuestRoute>
        }
      >
        <Route path="auth" element={<Navigate to="/auth/login" replace />} />
        <Route
          path="auth/login"
          element={
            <LazyPage>
              <SignInForm />
            </LazyPage>
          }
        />
        <Route
          path="auth/otp"
          element={
            <LazyPage>
              <ConfirmEmailForm />
            </LazyPage>
          }
        />
        <Route
          path="auth/forget_password"
          element={
            <LazyPage>
              <ForgotPasswordView />
            </LazyPage>
          }
        />
        <Route
          path="auth/forget_password/check_phone"
          element={
            <LazyPage>
              <ForgotPasswordCheckPhoneForm />
            </LazyPage>
          }
        />
        <Route
          path="auth/forget_password/verify"
          element={
            <LazyPage>
              <ForgotPasswordVerifyForm />
            </LazyPage>
          }
        />
      </Route>

      <Route
        element={
          <GuestRoute>
            <LazyPage>
              <WithoutCarouselCard />
            </LazyPage>
          </GuestRoute>
        }
      >
        <Route
          path="auth/link_expired"
          element={
            <LazyPage>
              <LinkExpiredForm />
            </LazyPage>
          }
        />
        <Route
          path="auth/reset_password"
          element={
            <LazyPage>
              <ResetPasswordForm />
            </LazyPage>
          }
        />
        <Route
          path="auth/reset_success"
          element={
            <LazyPage>
              <ResetSuccessForm />
            </LazyPage>
          }
        />
      </Route>

      <Route
        path="dashboard"
        element={
          <ProtectedRoute>
            <LazyPage>
              <DashboardPage />
            </LazyPage>
          </ProtectedRoute>
        }
      />

      <Route
        path="dashboard/notifications"
        element={
          <ProtectedRoute>
            <LazyPage>
              <NotificationsPage />
            </LazyPage>
          </ProtectedRoute>
        }
      />

      <Route
        path="dashboard/settings"
        element={
          <ProtectedRoute>
            <LazyPage>
              <ProfileSettingsPage />
            </LazyPage>
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
