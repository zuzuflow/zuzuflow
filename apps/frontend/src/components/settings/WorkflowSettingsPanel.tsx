import React from "react";
import { X, RotateCcw } from "lucide-react";
import type { WorkflowSettings, WorkflowRetryPolicy } from "@workflow/shared";
import { useWorkflowStore } from "../../store/workflowStore";
import { TagChipInput } from "../workflow/TagChipInput";

interface WorkflowSettingsPanelProps {
  onClose: () => void;
}

function DurationInput({
  label,
  value,
  placeholder,
  onChange,
  hint,
}: {
  label: string;
  value: string | undefined;
  placeholder: string;
  onChange: (v: string | undefined) => void;
  hint?: string;
}): React.ReactElement {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      <input
        type="text"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="flex h-8 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function NumberInput({
  label,
  value,
  placeholder,
  onChange,
  min,
  step,
}: {
  label: string;
  value: number | undefined;
  placeholder: string;
  onChange: (v: number | undefined) => void;
  min?: number;
  step?: number;
}): React.ReactElement {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      <input
        type="number"
        value={value ?? ""}
        placeholder={placeholder}
        min={min}
        step={step}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        className="flex h-8 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>
  );
}

export function WorkflowSettingsPanel({ onClose }: WorkflowSettingsPanelProps): React.ReactElement {
  const settings = useWorkflowStore((s) => s.settings);
  const setSettings = useWorkflowStore((s) => s.setSettings);
  const tags = useWorkflowStore((s) => s.tags);
  const setTags = useWorkflowStore((s) => s.setTags);

  const update = (patch: Partial<WorkflowSettings>) => {
    setSettings({ ...settings, ...patch });
  };

  const updateRetry = (patch: Partial<WorkflowRetryPolicy>) => {
    setSettings({ ...settings, retry: { ...settings.retry, ...patch } });
  };

  const handleReset = () => {
    setSettings({});
  };

  return (
    <div className="absolute right-4 top-14 z-40 w-80 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold text-foreground">Workflow Settings</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleReset}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary"
            title="Reset to defaults"
          >
            <RotateCcw size={13} />
          </button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto">
        {/* Tags */}
        <section>
          <p className="text-[11px] text-muted-foreground mb-2.5 font-medium uppercase tracking-wider">
            Tags
          </p>
          <TagChipInput value={tags} onChange={setTags} />
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            Used for filtering workflows in the list and via the API (e.g. <code>?tags=production</code>).
          </p>
        </section>

        {/* Workflow Timeouts */}
        <section>
          <p className="text-[11px] text-muted-foreground mb-2.5 font-medium uppercase tracking-wider">
            Workflow Timeouts
          </p>
          <div className="space-y-2.5">
            <DurationInput
              label="Execution Timeout"
              value={settings.workflowExecutionTimeout}
              placeholder="none (unlimited)"
              onChange={(v) => update({ workflowExecutionTimeout: v })}
              hint="Max total time for the workflow (e.g. 1h, 30m)"
            />
            <DurationInput
              label="Run Timeout"
              value={settings.workflowRunTimeout}
              placeholder="none (unlimited)"
              onChange={(v) => update({ workflowRunTimeout: v })}
              hint="Max time for a single run attempt"
            />
          </div>
        </section>

        {/* Activity Timeouts */}
        <section>
          <p className="text-[11px] text-muted-foreground mb-2.5 font-medium uppercase tracking-wider">
            Activity Timeouts
          </p>
          <div className="space-y-2.5">
            <DurationInput
              label="Start-to-Close Timeout"
              value={settings.activityStartToCloseTimeout}
              placeholder="5m (default)"
              onChange={(v) => update({ activityStartToCloseTimeout: v })}
              hint="Max time for each activity to complete"
            />
            <DurationInput
              label="Schedule-to-Start Timeout"
              value={settings.activityScheduleToStartTimeout}
              placeholder="none (unlimited)"
              onChange={(v) => update({ activityScheduleToStartTimeout: v })}
              hint="Max wait time before activity starts"
            />
          </div>
        </section>

        {/* Retry Policy */}
        <section>
          <p className="text-[11px] text-muted-foreground mb-2.5 font-medium uppercase tracking-wider">
            Retry Policy
          </p>
          <div className="space-y-2.5">
            <NumberInput
              label="Max Attempts"
              value={settings.retry?.maximumAttempts}
              placeholder="3"
              onChange={(v) => updateRetry({ maximumAttempts: v })}
              min={1}
            />
            <DurationInput
              label="Initial Interval"
              value={settings.retry?.initialInterval}
              placeholder="2s (default)"
              onChange={(v) => updateRetry({ initialInterval: v })}
            />
            <NumberInput
              label="Backoff Coefficient"
              value={settings.retry?.backoffCoefficient}
              placeholder="2"
              onChange={(v) => updateRetry({ backoffCoefficient: v })}
              min={1}
              step={0.1}
            />
            <DurationInput
              label="Max Interval"
              value={settings.retry?.maximumInterval}
              placeholder="30s (default)"
              onChange={(v) => updateRetry({ maximumInterval: v })}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
