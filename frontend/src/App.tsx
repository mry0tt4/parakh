import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Shell, RequireRole } from './components/Shell'
import { AuthProvider } from './lib/auth'
import { ApplicationsPage } from './pages/Applications'
import { AuditPage } from './pages/Audit'
import { DashboardPage } from './pages/Dashboard'
import { LandingPage } from './pages/Landing'
import { LoginPage } from './pages/Login'
import { NewApplicationPage } from './pages/NewApplication'
import { ApplicationDetailPage } from './pages/application/ApplicationDetail'
import { HealthCardPage } from './pages/application/HealthCardPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/welcome" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          {/* borrower-facing document view — rendered outside the console shell */}
          <Route path="/applications/:id/card" element={<HealthCardPage />} />
          <Route element={<Shell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/applications" element={<ApplicationsPage />} />
            <Route path="/applications/new" element={<NewApplicationPage />} />
            <Route path="/applications/:id" element={<ApplicationDetailPage />} />
            <Route
              path="/audit"
              element={
                <RequireRole roles={['risk_head', 'admin']}>
                  <AuditPage />
                </RequireRole>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
