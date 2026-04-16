import React from "react";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import { ApiProvider, type ApiProviderProps } from "./ApiProvider";
import { WorkflowsPage } from "../../../apps/frontend/src/pages/WorkflowsPage";
import { WorkflowEditorPage } from "../../../apps/frontend/src/pages/WorkflowEditorPage";
import { CredentialsPage } from "../../../apps/frontend/src/pages/CredentialsPage";
import { SettingsPage } from "../../../apps/frontend/src/pages/SettingsPage";

export interface WorkflowAppProps extends Omit<ApiProviderProps, "children"> {
  /**
   * Initial route to open. Defaults to "/" (workflow list).
   * Examples: "/editor/some-workflow-id", "/credentials"
   */
  initialPath?: string;
}

/**
 * Full workflow automation product embedded in a React app.
 *
 * ```tsx
 * import { WorkflowApp } from "@zuzuflow/react-sdk";
 * import "@zuzuflow/react-sdk/style.css";
 *
 * function MyPage() {
 *   return (
 *     <div style={{ height: "100vh" }}>
 *       <WorkflowApp apiUrl="https://api.example.com/api" token={myJwt} />
 *     </div>
 *   );
 * }
 * ```
 */
export function WorkflowApp({ apiUrl, token, initialPath = "/" }: WorkflowAppProps): React.ReactElement {
  return (
    <ApiProvider apiUrl={apiUrl} token={token}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={<WorkflowsPage />} />
          <Route path="/editor/:id" element={<WorkflowEditorPage />} />
          <Route path="/credentials" element={<CredentialsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MemoryRouter>
    </ApiProvider>
  );
}
