import React, { useEffect } from "react";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider, type ApiProviderProps } from "./ApiProvider";
import { Loader2 } from "lucide-react";
import { Toolbar } from "../../../apps/frontend/src/components/toolbar/Toolbar";
import { NodePalette } from "../../../apps/frontend/src/components/sidebar/NodePalette";
import { WorkflowCanvas } from "../../../apps/frontend/src/components/canvas/WorkflowCanvas";
import { PropertiesPanel } from "../../../apps/frontend/src/components/panels/PropertiesPanel";
import { ExecutionLog } from "../../../apps/frontend/src/components/panels/ExecutionLog";
import { useWorkflowStore } from "../../../apps/frontend/src/store/workflowStore";
import { useExecutionStore } from "../../../apps/frontend/src/store/executionStore";
import * as api from "../../../apps/frontend/src/lib/api";

export interface WorkflowDesignerProps extends Omit<ApiProviderProps, "children"> {
  /** ID of an existing workflow to load. Omit or pass "new" to create a new one. */
  workflowId?: string;
  /** Called after a successful save with the workflow id */
  onSave?: (workflowId: string) => void;
}

function DesignerInner({
  workflowId,
  onSave: _onSave,
}: Pick<WorkflowDesignerProps, "workflowId" | "onSave">) {
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const loadTemplate = useWorkflowStore((s) => s.loadTemplate);
  const resetWorkflow = useWorkflowStore((s) => s.resetWorkflow);
  const clearExecution = useExecutionStore((s) => s.clearExecution);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    clearExecution();
    if (!workflowId || workflowId === "new") {
      resetWorkflow();
      return;
    }
    setLoading(true);
    api
      .getWorkflow(workflowId)
      .then((wf) => loadTemplate(wf.template, wf.id, wf.name, wf.status))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  if (loading)
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-950">
        <Loader2 size={24} className="animate-spin text-indigo-400 mr-3" />
        <span className="text-slate-400 text-sm">Loading workflow…</span>
      </div>
    );

  if (error)
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-950 text-slate-400 text-sm">
        {error}
      </div>
    );

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 overflow-hidden">
      <div className="relative z-50 shrink-0">
        <Toolbar onNavigateBack={undefined} />
        <div className="h-12" />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <NodePalette />
        <div className="flex-1 relative overflow-hidden">
          <WorkflowCanvas />
        </div>
        {selectedNodeId && <PropertiesPanel />}
      </div>
      <ExecutionLog />
    </div>
  );
}

/**
 * Embeddable Workflow Designer screen — the drag-and-drop canvas, palette,
 * properties panel, and execution log all in one component. No routing, no
 * sidebar, no app shell.
 *
 * Mount it inside any container that has a defined height (e.g. `100vh`,
 * `100%` of a parent flex/grid cell). The component fills its parent.
 *
 * ```tsx
 * import { WorkflowDesigner } from "@zuzuflow/react-sdk";
 * import "@xyflow/react/dist/style.css";
 *
 * function MyDesignerPage() {
 *   return (
 *     <div style={{ height: "100vh" }}>
 *       <WorkflowDesigner
 *         apiUrl="https://app.zuzuflow.com/api"
 *         token={jwt}
 *         envSlug="production"
 *         workflowId="wf_abc123"
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function WorkflowDesigner({
  apiUrl,
  token,
  envSlug,
  workflowId,
  onSave,
}: WorkflowDesignerProps): React.ReactElement {
  // MemoryRouter is wrapped internally so the host app does NOT need to
  // provide a <BrowserRouter />. Some embedded children read useLocation()
  // for breadcrumb-style hints — they get a stable in-memory entry here.
  return (
    <ApiProvider apiUrl={apiUrl} token={token} envSlug={envSlug}>
      <MemoryRouter initialEntries={[`/editor/${workflowId ?? "new"}`]}>
        <DesignerInner workflowId={workflowId} onSave={onSave} />
      </MemoryRouter>
    </ApiProvider>
  );
}
