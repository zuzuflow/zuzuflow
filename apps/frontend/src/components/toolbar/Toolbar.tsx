import React, { useState, useRef, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import {
  Save,
  Play,
  Square,
  Upload,
  Download,
  CheckCircle2,
  Loader2,
  ChevronDown,
  CalendarClock,
  Zap,
  ArrowLeft,
  CalendarOff,
  History,
  Webhook,
  Copy,
  Power,
  PowerOff,
  Palette,
  Settings,
} from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";
import { useExecutionStore } from "../../store/executionStore";
import { useWorkflowSerializer } from "../../hooks/useWorkflowSerializer";
import { useExecutionSocket } from "../../hooks/useExecutionSocket";
import * as api from "../../lib/api";
import { cn } from "../../lib/utils";
import { DesignPanel } from "../design/DesignPanel";
import { WorkflowSettingsPanel } from "../settings/WorkflowSettingsPanel";
import { Button } from "../../components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/ui/tooltip";
import { Separator } from "../../components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";

type SaveState = "idle" | "saving" | "saved" | "error";
type ActivateState = "idle" | "activating" | "active" | "deactivating" | "error";

interface ToolbarProps {
  onNavigateBack?: () => void;
}

export function Toolbar({ onNavigateBack }: ToolbarProps): React.ReactElement {
  const location = useLocation();
  const isNewSubworkflow = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("subworkflow") === "true";
  }, [location.search]);

  const workflowName = useWorkflowStore((s) => s.workflowName);
  const workflowId = useWorkflowStore((s) => s.workflowId);
  const workflowStatus = useWorkflowStore((s) => s.workflowStatus);
  const isDirty = useWorkflowStore((s) => s.isDirty);
  const nodes = useWorkflowStore((s) => s.nodes);
  const tags = useWorkflowStore((s) => s.tags);
  const setWorkflowName = useWorkflowStore((s) => s.setWorkflowName);
  const toTemplate = useWorkflowStore((s) => s.toTemplate);
  const validateWorkflow = useWorkflowStore((s) => s.validateWorkflow);
  const markSaved = useWorkflowStore((s) => s.markSaved);
  const setWorkflowStatus = useWorkflowStore((s) => s.setWorkflowStatus);

  const executionId = useExecutionStore((s) => s.executionId);
  const executionStatus = useExecutionStore((s) => s.status);
  const startExecution = useExecutionStore((s) => s.startExecution);
  const clearExecution = useExecutionStore((s) => s.clearExecution);
  const setStatus = useExecutionStore((s) => s.setStatus);
  const openDrawer = useExecutionStore((s) => s.openDrawer);

  const { exportJson, exportYaml, importFromFile } = useWorkflowSerializer();

  const [saveState, setSaveState] = useState<SaveState>("idle");
  // Initialize activateState from the loaded workflow status
  const [activateState, setActivateState] = useState<ActivateState>(
    workflowStatus === "active" ? "active" : "idle"
  );
  const [isRunning, setIsRunning] = useState(false);
  const [showDesignPanel, setShowDesignPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useExecutionSocket(executionId);

  // Sync activateState when workflowStatus changes (e.g. after loading from API)
  const prevStatusRef = useRef(workflowStatus);
  if (prevStatusRef.current !== workflowStatus) {
    prevStatusRef.current = workflowStatus;
    if (workflowStatus === "active" && activateState === "idle") {
      setActivateState("active");
    } else if (workflowStatus !== "active" && activateState === "active") {
      setActivateState("idle");
    }
  }

  // Detect if this workflow has a Cron trigger node
  const hasCronTrigger = nodes.some((n) => (n.data as Record<string, unknown>).kind === "cron");
  const isScheduleActive = workflowStatus === "active";
  const isDeactivating = activateState === "deactivating";

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const errors = validateWorkflow();
    if (errors.length > 0) {
      errors.forEach((msg) => toast.error(msg));
      return;
    }
    setSaveState("saving");
    try {
      const template = toTemplate();
      if (workflowId) {
        const updated = await api.updateWorkflow(workflowId, { name: workflowName, template, tags });
        markSaved(workflowId, updated.status, updated.key);
      } else {
        const result = await api.createWorkflow({ name: workflowName, template, isSubworkflow: isNewSubworkflow || undefined, tags });
        markSaved(result.id, result.status, result.key);
      }
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      console.error("Save failed:", err);
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  // ── Activate (enables real Cron schedule on backend) ─────────────────────
  const handleActivate = async () => {
    const errors = validateWorkflow();
    if (errors.length > 0) {
      errors.forEach((msg) => toast.error(msg));
      return;
    }
    setActivateState("activating");
    try {
      const template = toTemplate();
      let id = workflowId;
      if (!id) {
        const created = await api.createWorkflow({ name: workflowName, template, isSubworkflow: isNewSubworkflow || undefined, tags });
        id = created.id;
        markSaved(id, "draft", created.key);
      } else if (isDirty) {
        const updated = await api.updateWorkflow(id, { name: workflowName, template, tags });
        markSaved(id, undefined, updated.key);
      }
      const activated = await api.activateWorkflow(id);
      setWorkflowStatus(activated.status);
      setActivateState("active");
    } catch (err) {
      console.error("Activate failed:", err);
      setActivateState("error");
      setTimeout(() => setActivateState("idle"), 3000);
    }
  };

  // ── Deactivate (stops the Cron schedule) ─────────────────────────────────
  const handleDeactivate = async () => {
    if (!workflowId) return;
    setActivateState("deactivating");
    try {
      const deactivated = await api.deactivateWorkflow(workflowId);
      setWorkflowStatus(deactivated.status);
      setActivateState("idle");
    } catch (err) {
      console.error("Deactivate failed:", err);
      setActivateState("active"); // revert
    }
  };

  // Webhook URL shown while waiting for inbound request
  const [webhookWaitUrl, setWebhookWaitUrl] = useState<string | null>(null);
  const [webhookCopied, setWebhookCopied] = useState(false);

  const copyWebhookUrl = () => {
    if (!webhookWaitUrl) return;
    navigator.clipboard.writeText(webhookWaitUrl).then(() => {
      setWebhookCopied(true);
      setTimeout(() => setWebhookCopied(false), 2000);
    });
  };

  // ── Test Run ──────────────────────────────────────────────────────────────
  const handleRun = async () => {
    const errors = validateWorkflow();
    if (errors.length > 0) {
      errors.forEach((msg) => toast.error(msg));
      return;
    }
    setIsRunning(true);
    setWebhookWaitUrl(null);
    try {
      clearExecution();

      const template = toTemplate();
      let id = workflowId;
      if (!id) {
        const created = await api.createWorkflow({ name: workflowName, template, isSubworkflow: isNewSubworkflow || undefined, tags });
        id = created.id;
        markSaved(id, "draft", created.key);
      } else if (isDirty) {
        const updated = await api.updateWorkflow(id, { name: workflowName, template, tags });
        markSaved(id, undefined, updated.key);
      }

      // Activate transiently so backend allows execution
      const activated = await api.activateWorkflow(id);
      setWorkflowStatus(activated.status);

      const result = await api.startExecution(id);
      startExecution(result.id);
      openDrawer();

      // If the trigger is a webhook node, show the URL to hit
      const webhookNode = template.nodes.find((n) => n.kind === "webhook");
      if (webhookNode) {
        const cfg = webhookNode.config as { path?: string };
        if (cfg.path) {
          const base = (import.meta.env.VITE_API_URL as string | undefined) ?? `${window.location.protocol}//${window.location.hostname}:4000/api`;
          setWebhookWaitUrl(`${base}/webhooks/inbound/${cfg.path}`);
        }
      }
    } catch (err) {
      console.error("Test run failed:", err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleStop = async () => {
    if (!executionId) return;
    setStatus("cancelled");
    try {
      await api.cancelExecution(executionId);
    } catch (err) {
      console.error("Cancel failed:", err);
      setStatus("running");
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importFromFile(file).catch((err) => {
      console.error("Import failed:", err);
      toast.error(`Import failed: ${String(err)}`);
    });
    e.target.value = "";
  };

  const isExecutionActive =
    executionStatus === "running" || executionStatus === "pending";

  const saveButtonLabel = {
    idle: "Save",
    saving: "Saving…",
    saved: "Saved",
    error: "Error",
  }[saveState];

  // Clear webhook URL once execution finishes
  React.useEffect(() => {
    if (executionStatus && executionStatus !== "running" && executionStatus !== "pending") {
      setWebhookWaitUrl(null);
    }
  }, [executionStatus]);

  return (
    <TooltipProvider delayDuration={0}>
    <div className="absolute top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border">
    {/* Webhook waiting banner */}
    {webhookWaitUrl && isExecutionActive && (
      <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/10 border-b border-primary/20 text-xs">
        <Webhook size={12} className="text-primary shrink-0 animate-pulse" />
        <span className="text-primary font-medium">Waiting for webhook —</span>
        <span className="text-primary font-medium">send a request to:</span>
        <code className="flex-1 truncate text-primary font-mono bg-primary/10 px-2 py-0.5 rounded">
          {webhookWaitUrl}
        </code>
        <button
          onClick={copyWebhookUrl}
          className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-primary/20 text-primary hover:text-primary transition-colors shrink-0"
        >
          <Copy size={11} />
          {webhookCopied ? "Copied!" : "Copy"}
        </button>
      </div>
    )}
    <div className="h-12 flex items-center px-4 gap-3">
      {/* Back button */}
      {onNavigateBack && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onNavigateBack}
            >
              <ArrowLeft size={13} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back to workflows</TooltipContent>
        </Tooltip>
      )}

      {/* Workflow name */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <input
          type="text"
          className="px-2 py-1 text-sm font-semibold bg-transparent border border-transparent hover:border-border focus:border-indigo-500 rounded text-foreground focus:outline-none focus:bg-secondary transition-colors max-w-xs"
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          aria-label="Workflow name"
        />
        {isDirty && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
        )}
      </div>

      {/* Status badge */}
      {workflowId ? (
        <span className={cn(
          "px-2 py-0.5 text-[10px] font-bold rounded uppercase",
          workflowStatus === "active" ? "bg-emerald-900 text-emerald-300"
            : workflowStatus === "inactive" ? "bg-muted text-muted-foreground"
            : "bg-amber-900 text-amber-300"
        )}>
          {workflowStatus ?? "saved"}
        </span>
      ) : (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-muted text-muted-foreground uppercase">
          Draft
        </span>
      )}

      <Separator orientation="vertical" className="h-5" />

      {/* Import */}
      <input ref={fileInputRef} type="file" accept=".json,.yaml,.yml" className="hidden" onChange={handleImport} />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={13} className="mr-1.5" />
            Import
          </Button>
        </TooltipTrigger>
        <TooltipContent>Import from JSON/YAML</TooltipContent>
      </Tooltip>

      {/* Design */}
      <div className="relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowDesignPanel((v) => !v)}
            >
              <Palette size={13} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Canvas Design</TooltipContent>
        </Tooltip>
        {showDesignPanel && (
          <DesignPanel onClose={() => setShowDesignPanel(false)} />
        )}
      </div>

      {/* Workflow Settings */}
      <div className="relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowSettingsPanel((v) => !v)}
            >
              <Settings size={13} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Workflow Settings</TooltipContent>
        </Tooltip>
        {showSettingsPanel && (
          <WorkflowSettingsPanel onClose={() => setShowSettingsPanel(false)} />
        )}
      </div>

      {/* Export */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <Download size={13} className="mr-1.5" />
            Export
            <ChevronDown size={11} className="ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => exportJson()}>
            Export JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportYaml()}>
            Export YAML
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="h-5" />

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={saveState === "saving"}
        variant={saveState === "saved" ? "default" : saveState === "error" ? "destructive" : "secondary"}
        size="sm"
      >
        {saveState === "saving" ? <Loader2 size={13} className="animate-spin mr-1.5" />
          : saveState === "saved" ? <CheckCircle2 size={13} className="mr-1.5" />
          : <Save size={13} className="mr-1.5" />}
        {saveButtonLabel}
      </Button>

      {/* Activate / Deactivate — shown for all saved workflows */}
      {workflowId && (
        isScheduleActive ? (
          <Button
            onClick={handleDeactivate}
            disabled={activateState === "deactivating"}
            title="Deactivate this workflow"
            variant="default"
            size="sm"
            className="group bg-emerald-700 hover:bg-red-800 text-white"
          >
            {isDeactivating
              ? <Loader2 size={13} className="animate-spin mr-1.5" />
              : <>
                  <CheckCircle2 size={13} className="mr-1.5 group-hover:hidden" />
                  <PowerOff size={13} className="mr-1.5 hidden group-hover:block" />
                </>}
            <span className="group-hover:hidden">Active</span>
            <span className="hidden group-hover:inline">Deactivate</span>
          </Button>
        ) : (
          <Button
            onClick={handleActivate}
            disabled={activateState === "activating"}
            title="Activate this workflow"
            variant={activateState === "error" ? "destructive" : "default"}
            size="sm"
            className={activateState === "error" ? undefined : "bg-amber-700 hover:bg-amber-600 text-white"}
          >
            {activateState === "activating"
              ? <Loader2 size={13} className="animate-spin mr-1.5" />
              : <Power size={13} className="mr-1.5" />}
            {activateState === "error" ? "Error" : "Activate"}
          </Button>
        )
      )}

      {/* Test Run / Stop */}
      {isExecutionActive ? (
        <Button
          onClick={handleStop}
          variant="destructive"
          size="sm"
        >
          <Square size={13} className="mr-1.5" />
          Stop
        </Button>
      ) : (
        <Button
          onClick={handleRun}
          disabled={isRunning}
          size="sm"
          title={hasCronTrigger ? "Runs immediately for testing — use Activate Schedule for real cron" : "Run workflow now"}
        >
          {isRunning ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <Zap size={13} className="mr-1.5" />}
          {hasCronTrigger ? "Test Run" : "Run"}
        </Button>
      )}
    </div>
    </div>
    </TooltipProvider>
  );
}
