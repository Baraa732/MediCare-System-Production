import { Navigate, Route, Routes } from "react-router";
import { AdminShell } from "@/features/layout/AdminShell";
import { DashboardPage } from "@/pages/DashboardPage";
import { StaffPage } from "@/pages/StaffPage";
import { AppointmentsPage } from "@/pages/AppointmentsPage";
import { SchedulePage } from "@/pages/SchedulePage";
import { PatientsPage } from "@/pages/PatientsPage";
import { ClinicSettingsPage } from "@/pages/ClinicSettingsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { ActivateCodePage } from "@/pages/auth/ActivateCodePage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { OtpPage } from "@/pages/auth/OtpPage";
import { SetPasswordPage } from "@/pages/auth/SetPasswordPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { AuthShell, GuestRoute, ProtectedRoute } from "@/router/ProtectedRoute";

export function AppRouter() {
  return (
    <Routes>
      <Route index element={<Navigate to="/auth/login" replace />} />

      <Route
        element={
          <GuestRoute>
            <AuthShell />
          </GuestRoute>
        }
      >
        <Route path="auth/login" element={<LoginPage />} />
        <Route path="auth/activate-code" element={<ActivateCodePage />} />
        <Route path="auth/register" element={<RegisterPage />} />
        <Route path="auth/otp" element={<OtpPage />} />
        <Route path="auth/set-password" element={<SetPasswordPage />} />
        <Route path="auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="auth/activation" element={<Navigate to="/auth/activate-code" replace />} />
      </Route>

      <Route
        element={
          <ProtectedRoute>
            <AdminShell />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="dashboard/staff" element={<StaffPage />} />
        <Route path="dashboard/appointments" element={<AppointmentsPage />} />
        <Route path="dashboard/schedule" element={<SchedulePage />} />
        <Route path="dashboard/patients" element={<PatientsPage />} />
        <Route path="dashboard/settings" element={<ClinicSettingsPage />} />
        <Route path="dashboard/analytics" element={<AnalyticsPage />} />
        <Route path="dashboard/profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  );
}
