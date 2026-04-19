import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Loader2, GitFork, Plus } from "lucide-react";
import { Toolbar } from "../components/toolbar/Toolbar";
import { NodePalette } from "../components/sidebar/NodePalette";
import { WorkflowCanvas } from "../components/canvas/WorkflowCanvas";
import { PropertiesPanel } from "../components/panels/PropertiesPanel";
import { ExecutionLog } from "../components/panels/ExecutionLog";
import { useWorkflowStore } from "../store/workflowStore";
import { useExecutionStore } from "../store/executionStore";
import { AiBuilderFab } from "../components/ai/AiBuilderFab";
import { CustomNodeBuilder } from "../components/custom-nodes/CustomNodeBuilder";
import { useCanvasShortcuts } from "../hooks/useCanvasShortcuts";
import * as api from "../lib/api";

export function WorkflowEditorPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId);
  const selectedNodeIds = useWorkflowStore((s) => s.selectedNodeIds);
  useCanvasShortcuts();
  const loadTemplate = useWorkflowStore((s) => s.loadTemplate);
  const resetWorkflow = useWorkflowStore((s) => s.resetWorkflow);
  const addNode = useWorkflowStore((s) => s.addNode);
  const nodes = useWorkflowStore((s) => s.nodes);
  const clearExecution = useExecutionStore((s) => s.clearExecution);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubworkflow, setIsSubworkflow] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);

  useEffect(() => {
    const handler = () => setBuilderOpen(true);
    window.addEventListener("open-custom-node-builder", handler);
    return () => window.removeEventListener("open-custom-node-builder", handler);
  }, []);

  const isNewSubworkflow = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("subworkflow") === "true";
  }, [location.search]);

  useEffect(() => {
    // Always start clean when mounting the editor
    clearExecution();

    if (!id || id === "new") {
      resetWorkflow();
      setIsSubworkflow(isNewSubworkflow);

      // Auto-place subflow_input + subflow_output nodes for new subworkflows
      if (isNewSubworkflow) {
        // Use setTimeout so the reset completes first
        setTimeout(() => {
          addNode("subflow_input", { x: 100, y: 200 });
          addNode(
            "subflow_output",
            { x: 480, y: 200 },
            { outputIndex: 0, label: "output 1" },
          );
        }, 50);
      }
      return;
    }

    setLoading(true);
    setError(null);
    api
      .getWorkflow(id)
      .then((wf) => {
        loadTemplate(
          wf.template,
          wf.id,
          wf.name,
          wf.status,
          wf.tags ?? [],
          wf.key,
        );
        setIsSubworkflow(!!wf.isSubworkflow);
      })
      .catch((err) => {
        console.error("Failed to load workflow:", err);
        setError(String(err));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Count existing subflow_output nodes so we know the next index to add
  const subflowOutputCount = useMemo(
    () =>
      nodes.filter(
        (n) => (n.data as Record<string, unknown>).kind === "subflow_output",
      ).length,
    [nodes],
  );

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-indigo-400 mr-3" />
        <span className="text-muted-foreground text-sm">Loading workflow…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center bg-background text-muted-foreground">
        <p className="text-sm mb-4">Failed to load workflow: {error}</p>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 text-sm rounded bg-muted hover:bg-slate-600 text-foreground transition-colors"
        >
          Back to workflows
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      {/* Top toolbar */}
      <div className="relative z-50 shrink-0">
        <Toolbar onNavigateBack={() => navigate("/")} />
        <div className="h-12" />
      </div>

      {/* Subworkflow header bar */}
      {isSubworkflow && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-sky-950 border-b border-sky-800">
          <GitFork size={14} className="text-sky-400" />
          <span className="text-xs font-medium text-sky-300">Subworkflow</span>
          <span className="text-xs text-sky-600 mx-1">—</span>
          <span className="text-xs text-sky-500">
            {subflowOutputCount} output{subflowOutputCount !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() =>
              addNode(
                "subflow_output",
                { x: 480, y: 200 + subflowOutputCount * 120 },
                {
                  outputIndex: subflowOutputCount,
                  label: `output ${subflowOutputCount + 1}`,
                },
              )
            }
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-sky-800 hover:bg-sky-700 text-sky-200 transition-colors"
          >
            <Plus size={12} />
            Add Output
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <NodePalette isSubworkflow={isSubworkflow} />
        <div className="flex-1 relative overflow-hidden">
          <WorkflowCanvas />
        </div>
        {(selectedNodeId || selectedEdgeId || selectedNodeIds.length > 1) && (
          <PropertiesPanel />
        )}
      </div>

      <ExecutionLog />
      <AiBuilderFab />
      <CustomNodeBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onSaved={() => {
          setBuilderOpen(false);
          // Palette's useCustomNodeTemplates hook has its own refresh trigger;
          // emit an event so it re-fetches after save.
          window.dispatchEvent(new CustomEvent("custom-node-template-saved"));
        }}
      />
    </div>
  );
}
