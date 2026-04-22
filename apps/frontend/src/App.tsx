import React from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
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
import { VerifyEmailPage } from "./pages/VerifyEmailPage";

function AuthGuard({
  children,
}: {
  children: React.ReactElement;
}): React.ReactElement {
  const isAuthenticated = useApiConfigStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

// Uses createBrowserRouter (the data router) instead of the classic
// <BrowserRouter> + <Routes> pair. The only functional difference for us is
// that useBlocker() works — which is what the UnsavedChangesGuard relies on
// to intercept navigation when the editor has unsaved changes. Every
// pre-existing hook (useNavigate, useParams, useLocation, Link, NavLink)
// behaves identically under the data router.
const router = createBrowserRouter([
  // ── Public ─────────────────────────────────────────────────────────────
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
  { path: "/invite/:token", element: <InviteAcceptPage /> },
  { path: "/verify-email", element: <VerifyEmailPage /> },
  {
    path: "/mfa-setup",
    element: (
      <AuthGuard>
        <MfaEnrollmentPage />
      </AuthGuard>
    ),
  },

  // Authenticated but no org selected yet
  { path: "/org-picker", element: <OrgPickerPage /> },

  // ── Protected with sidebar shell ───────────────────────────────────────
  // Layout route — AppShell renders an <Outlet /> for the matched child.
  {
    element: (
      <AuthGuard>
        <AppShell />
      </AuthGuard>
    ),
    children: [
      // `/` redirects to /dashboard — the app's real home screen.
      { path: "/", element: <Navigate to="/dashboard" replace /> },
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/workflows", element: <WorkflowsPage /> },
      { path: "/credentials", element: <CredentialsPage /> },
      { path: "/logs", element: <LogsPage /> },
      { path: "/settings", element: <SettingsPage /> },
    ],
  },

  // Protected full-bleed (no sidebar)
  {
    path: "/editor/:id",
    element: (
      <AuthGuard>
        <WorkflowEditorPage />
      </AuthGuard>
    ),
  },

  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function App(): React.ReactElement {
  return <RouterProvider router={router} />;
}
