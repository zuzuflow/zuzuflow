import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useApiConfigStore } from "./store/apiConfigStore";
import { AppShell } from "./components/layout/AppShell";
import { WorkflowsPage } from "./pages/WorkflowsPage";
import { WorkflowEditorPage } from "./pages/WorkflowEditorPage";
import { CredentialsPage } from "./pages/CredentialsPage";
import { LogsPage } from "./pages/LogsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { OrgPickerPage } from "./pages/OrgPickerPage";
import { MfaEnrollmentPage } from "./pages/MfaEnrollmentPage";
import { InviteAcceptPage } from "./pages/InviteAcceptPage";

function AuthGuard({
  children,
}: {
  children: React.ReactElement;
}): React.ReactElement {
  const isAuthenticated = useApiConfigStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App(): React.ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/invite/:token" element={<InviteAcceptPage />} />
        <Route
          path="/mfa-setup"
          element={
            <AuthGuard>
              <MfaEnrollmentPage />
            </AuthGuard>
          }
        />

        {/* Authenticated but no org selected yet */}
        <Route path="/org-picker" element={<OrgPickerPage />} />

        {/* Protected with sidebar shell */}
        <Route
          element={
            <AuthGuard>
              <AppShell />
            </AuthGuard>
          }
        >
          {/* `/` redirects to /dashboard — the app's real home screen.
              `/workflows` is the list page (was previously mounted on `/`). */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/credentials" element={<CredentialsPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Protected full-bleed (no sidebar) */}
        <Route
          path="/editor/:id"
          element={
            <AuthGuard>
              <WorkflowEditorPage />
            </AuthGuard>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
