import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './layout/AppShell'
import AuthGuard from './components/guards/AuthGuard'
import { NotificationProvider } from './features/notifications/NotificationProvider'
import LoginPage from './pages/auth/LoginPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'

import Dashboard from './pages/dashboard'
import ActivationCodes from './pages/platform/ActivationCodes'
import Clinics from './pages/platform/Clinics'
import PlatformUsers from './pages/platform/PlatformUsers'
import Administrators from './pages/platform/Administrators'
import Metrics from './pages/metrics'
import Alerts from './pages/alerts'
import LogsPage from './pages/logs'
import APM from './pages/apm'
import Monitors from './pages/monitors'
import ProfilePage from './pages/profile'
import Integrations from './pages/integrations'
import Settings from './pages/settings'
import DocsPage from './pages/docs'
import BusinessIntelligence from './pages/bi'
import ServiceMapPage from './pages/observability/service-map'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/*" element={
          <AuthGuard>
            <NotificationProvider>
              <AppShell>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/bi" element={<BusinessIntelligence />} />
                <Route path="/activation-codes" element={<ActivationCodes />} />
                <Route path="/clinics" element={<Clinics />} />
                <Route path="/users" element={<PlatformUsers />} />
                <Route path="/administrators" element={<Administrators />} />
                <Route path="/monitoring" element={<Navigate to="/" replace />} />
                <Route path="/traces" element={<Navigate to="/apm" replace />} />
                <Route path="/metrics" element={<Metrics />} />
                <Route path="/logs" element={<LogsPage />} />
                <Route path="/apm" element={<APM />} />
                <Route path="/observability/service-map" element={<ServiceMapPage />} />
                <Route path="/monitors" element={<Monitors />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/docs" element={<DocsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AppShell>
            </NotificationProvider>
          </AuthGuard>
        } />
      </Routes>
    </BrowserRouter>
  )
}
