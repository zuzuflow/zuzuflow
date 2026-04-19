import React, { useState } from "react";
import {
  Bot,
  X,
  Loader2,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Layers,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { aiGenerateWorkflow } from "../../lib/api";
import type { AiBuildMode } from "../../lib/api";
import { useWorkflowStore } from "../../store/workflowStore";
import type { WorkflowTemplate } from "@workflow/shared";

interface AiBuilderPanelProps {
  onClose: () => void;
}

const EXAMPLE_PROMPTS = [
  "Fetch data from a webhook, transform it with JavaScript, and store in PostgreSQL",
  "Every hour, check a Google Sheet and send a Slack notification for new rows",
  "Receive a webhook, call an OpenAI LLM to summarize the content, then send an email",
  "Manual trigger → HTTP request to an API → parse JSON → if status is error send email, else store in Redis",
];

const MODES: {
  value: AiBuildMode;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    value: "update",
    label: "Update Existing",
    icon: <RefreshCw size={14} />,
    description: "Add to or modify the current workflow",
  },
  {
    value: "new_with_existing",
    label: "New + Existing Nodes",
    icon: <Layers size={14} />,
    description: "New workflow inspired by current nodes",
  },
];

export function AiBuilderPanel({
  onClose,
}: AiBuilderPanelProps): React.ReactElement {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<AiBuildMode>("update");
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    template: WorkflowTemplate;
    explanation: string;
  } | null>(null);

  const loadTemplate = useWorkflowStore((s) => s.loadTemplate);
  const resetWorkflow = useWorkflowStore((s) => s.resetWorkflow);
  const toTemplate = useWorkflowStore((s) => s.toTemplate);
  const nodes = useWorkflowStore((s) => s.nodes);
  const workflowId = useWorkflowStore((s) => s.workflowId);
  const workflowName = useWorkflowStore((s) => s.workflowName);
  const workflowStatus = useWorkflowStore((s) => s.workflowStatus);
  const tags = useWorkflowStore((s) => s.tags);

  const hasExistingNodes = nodes.length > 0;

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const existingTemplate =
        hasExistingNodes ? toTemplate() : undefined;
      const res = await aiGenerateWorkflow(
        prompt.trim(),
        mode,
        existingTemplate,
      );
      setResult({
        template: res.template as WorkflowTemplate,
        explanation: res.explanation,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  function handleApply() {
    if (!result?.template) return;
    if (mode === "update" && workflowId) {
      // Preserve existing workflow ID, name, status, tags
      loadTemplate(
        result.template,
        workflowId,
        workflowName,
        workflowStatus ?? undefined,
        tags,
      );
    } else if (mode === "new_with_existing") {
      resetWorkflow();
      loadTemplate(result.template);
      navigate("/editor/new");
    } else {
      resetWorkflow();
      loadTemplate(result.template);
    }
    onClose();
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[420px] max-h-[600px] flex flex-col rounded-xl border border-border bg-background shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-orange-400" />
          <span className="text-sm font-semibold text-foreground">
            AI Workflow Builder
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Prompt input */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Describe the workflow you want to build
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., When a webhook is received, fetch user data from PostgreSQL and send a Slack notification…"
            className="w-full h-24 px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            disabled={generating}
          />
        </div>

        {/* Mode selector */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Build mode
          </label>
          <div className="space-y-1.5">
            {MODES.map((m) => {
              const disabled = !hasExistingNodes;
              return (
                <button
                  key={m.value}
                  onClick={() => !disabled && setMode(m.value)}
                  disabled={disabled}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md border text-left transition-colors ${
                    mode === m.value
                      ? "border-orange-500 bg-orange-500/10 text-foreground"
                      : disabled
                        ? "border-border bg-secondary/50 text-muted-foreground/50 cursor-not-allowed"
                        : "border-border bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className={mode === m.value ? "text-orange-400" : ""}>
                    {m.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{m.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {m.description}
                      {disabled ? " (no nodes on canvas)" : ""}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Example prompts */}
        {!result && !generating && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Try an example:
            </p>
            <div className="space-y-1.5">
              {EXAMPLE_PROMPTS.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(ex)}
                  className="w-full text-left text-xs px-3 py-2 rounded-md bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading state */}
        {generating && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 size={18} className="animate-spin mr-2 text-orange-400" />
            <span className="text-sm">Generating workflow…</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded-md px-3 py-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Result preview */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-900/40 rounded-md px-3 py-2">
              <Sparkles size={14} className="shrink-0 mt-0.5" />
              <span>{result.explanation}</span>
            </div>

            {/* Node list preview */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Generated nodes:
              </p>
              <div className="space-y-1">
                {(result.template.nodes ?? []).map((node, i) => (
                  <div
                    key={node.id || i}
                    className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded bg-secondary border border-border"
                  >
                    <span className="text-muted-foreground">{i + 1}.</span>
                    <span className="font-medium text-foreground">
                      {node.label || node.kind}
                    </span>
                    <span className="text-muted-foreground ml-auto">
                      {node.kind}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-muted/50">
        {!result ? (
          <button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            Generate Workflow
          </button>
        ) : (
          <>
            <button
              onClick={() => {
                setResult(null);
                setError(null);
              }}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-md bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={handleApply}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-orange-500 hover:bg-orange-600 text-white transition-colors"
            >
              <Sparkles size={14} />
              Apply to Canvas
            </button>
          </>
        )}
      </div>
    </div>
  );
}
