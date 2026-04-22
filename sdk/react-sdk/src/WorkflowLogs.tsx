import React from "react";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider, type ApiProviderProps } from "./ApiProvider";
import { LogsPage } from "../../../apps/frontend/src/pages/LogsPage";

export interface WorkflowLogsProps extends Omit<ApiProviderProps, "children"> {
  /**
   * Optional className applied to the outer container — useful when you want
   * to constrain the embed to a specific size with Tailwind utilities. The
   * component already fills its parent (`h-full`) by default.
   */
  className?: string;
}

/**
 * Embeddable Workflow Logs screen — Grafana-style log search across every
 * execution, with an Executions tab for browsing run history. No routing,
 * no sidebar, no app shell.
 *
 * Mount it inside any container that has a defined height. The component
 * fills its parent (it sets `h-full min-h-0` internally).
 *
 * ```tsx
 * import { WorkflowLogs } from "@zuzuflow/react-sdk";
 *
 * function MyLogsPage() {
 *   return (
 *     <div style={{ height: "100vh" }}>
 *       <WorkflowLogs
 *         apiUrl="https://app.zuzuflow.com/api"
 *         token={jwt}
 *         envSlug="production"
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function WorkflowLogs({
  apiUrl,
  token,
  envSlug,
  className,
}: WorkflowLogsProps): React.ReactElement {
  // MemoryRouter is wrapped internally so the host app does NOT need to
  // provide a router. Defensive — LogsPage doesn't hit useLocation today
  // but its child components might gain one (e.g. breadcrumb hint).
  return (
    <ApiProvider apiUrl={apiUrl} token={token} envSlug={envSlug}>
      <MemoryRouter initialEntries={["/logs"]}>
        <div className={className ?? "h-full w-full bg-background text-foreground"}>
          <LogsPage />
        </div>
      </MemoryRouter>
    </ApiProvider>
  );
}
