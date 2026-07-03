import React, { useEffect } from "react";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider, type ApiProviderProps } from "./ApiProvider";
import { Loader2 } from "lucide-react";
import { Toolbar } from "../../../apps/frontend/src/components/toolbar/Toolbar";
import { Toaster } from "../../../apps/frontend/src/components/ui/sonner";
import { NodePalette } from "../../../apps/frontend/src/components/sidebar/NodePalette";
import { WorkflowCanvas } from "../../../apps/frontend/src/components/canvas/WorkflowCanvas";
import { PropertiesPanel } from "../../../apps/frontend/src/components/panels/PropertiesPanel";
import { ExecutionLog } from "../../../apps/frontend/src/components/panels/ExecutionLog";
import { useWorkflowStore } from "../../../apps/frontend/src/store/workflowStore";
import { useExecutionStore } from "../../../apps/frontend/src/store/executionStore";
import { useCanvasDesignStore } from "../../../apps/frontend/src/store/canvasDesignStore";
import {
  useSdkHostStore,
  type EmittedWorkflow,
  type WorkflowDraft,
  type BeforeSaveHook,
} from "../../../apps/frontend/src/store/sdkHostStore";
import * as api from "../../../apps/frontend/src/lib/api";

/** Public theme option for the embedded designer. */
export type WorkflowDesignerTheme = "light" | "dark";

export interface WorkflowDesignerProps extends Omit<ApiProviderProps, "children"> {
  /** ID of an existing workflow to load. Omit or pass "new" to create a new one. */
  workflowId?: string;
  /**
   * Canvas theme. "light" maps to the built-in BPMN light theme, "dark" to the
   * default dark canvas. Defaults to "dark". Changing this prop updates the
   * canvas live; a user's in-app theme toggle still works within the session.
   */
  theme?: WorkflowDesignerTheme;
  /**
   * Runs before a save is persisted. Return `false` to cancel silently, a
   * string to cancel with an error toast, or nothing/`true` to proceed. May be
   * async. Use this to enforce host rules (e.g. require an External Trigger).
   */
  beforeSave?: BeforeSaveHook;
  /** Called after a successful save with the full workflow JSON payload. */
  onSave?: (workflow: EmittedWorkflow) => void;
  /**
   * Called when the user exports a workflow. Receives the serialized content,
   * a suggested filename, and the format. When provided, the SDK hands the
   * file to the host instead of triggering a browser download.
   */
  onExport?: (content: string, filename: string, format: "json" | "yaml") => void;
  /**
   * Allow-list of node kinds shown in the palette. When set, ONLY these kinds
   * appear (takes precedence over hiddenNodeKinds). Kind ids are the registry
   * keys, e.g. "external_trigger", "webhook", "cron", "http_request".
   */
  allowedNodeKinds?: string[];
  /** Deny-list of node kinds to hide from the palette. */
  hiddenNodeKinds?: string[];
}

type DesignerInnerProps = Pick<
  WorkflowDesignerProps,
  "workflowId" | "theme" | "beforeSave" | "onSave" | "onExport" | "allowedNodeKinds" | "hiddenNodeKinds"
>;

function DesignerInner({
  workflowId,
  theme,
  beforeSave,
  onSave,
  onExport,
  allowedNodeKinds,
  hiddenNodeKinds,
}: DesignerInnerProps) {
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const loadTemplate = useWorkflowStore((s) => s.loadTemplate);
  const resetWorkflow = useWorkflowStore((s) => s.resetWorkflow);
  const clearExecution = useExecutionStore((s) => s.clearExecution);
  const setTheme = useCanvasDesignStore((s) => s.setTheme);
  const setHost = useSdkHostStore((s) => s.setHost);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Apply the host-requested theme to the canvas store.
  useEffect(() => {
    if (theme) setTheme(theme === "light" ? "bpmn-light" : "dark");
  }, [theme, setTheme]);

  // Register host config (emit callbacks, beforeSave hook, palette filter) so
  // the deeply-nested Toolbar / serializer / palette can read it. Cleared on
  // unmount. Kinds are joined into stable deps so identity churn doesn't thrash.
  const allowedKey = allowedNodeKinds?.join(",");
  const hiddenKey = hiddenNodeKinds?.join(",");
  useEffect(() => {
    setHost({ onSave, onExport, beforeSave, allowedNodeKinds, hiddenNodeKinds });
    return () =>
      setHost({
        onSave: undefined,
        onExport: undefined,
        beforeSave: undefined,
        allowedNodeKinds: undefined,
        hiddenNodeKinds: undefined,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSave, onExport, beforeSave, allowedKey, hiddenKey, setHost]);

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
      {/* Toasts (save validation, beforeSave errors, etc). The standalone app
          mounts this in main.tsx; embedded via the SDK we mount it here so host
          apps see the same feedback without providing their own <Toaster />. */}
      <Toaster position="bottom-right" richColors closeButton />
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
  theme,
  beforeSave,
  onSave,
  onExport,
  allowedNodeKinds,
  hiddenNodeKinds,
}: WorkflowDesignerProps): React.ReactElement {
  // MemoryRouter is wrapped internally so the host app does NOT need to
  // provide a <BrowserRouter />. Some embedded children read useLocation()
  // for breadcrumb-style hints — they get a stable in-memory entry here.
  return (
    <ApiProvider apiUrl={apiUrl} token={token} envSlug={envSlug}>
      <MemoryRouter initialEntries={[`/editor/${workflowId ?? "new"}`]}>
        <DesignerInner
          workflowId={workflowId}
          theme={theme}
          beforeSave={beforeSave}
          onSave={onSave}
          onExport={onExport}
          allowedNodeKinds={allowedNodeKinds}
          hiddenNodeKinds={hiddenNodeKinds}
        />
      </MemoryRouter>
    </ApiProvider>
  );
}
