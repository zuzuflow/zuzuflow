import React, { useEffect, useState } from "react";
import type { WorkflowTriggerOutConfig } from "@workflow/shared";
import { TemplateTextarea } from "../TemplateTextarea";
import { request } from "../../../lib/api";
import { Label } from "../../ui/label";

interface Props {
  config: WorkflowTriggerOutConfig;
  onChange: (patch: Partial<WorkflowTriggerOutConfig>) => void;
}

interface WorkflowOption {
  id: string;
  name: string;
}

export function WorkflowTriggerOutForm({ config, onChange }: Props): React.ReactElement {
  const [workflows, setWorkflows] = useState<WorkflowOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request<{ items: WorkflowOption[] }>("/workflows?hasTrigger=workflow_trigger_in")
      .then((data) => setWorkflows(data.items ?? []))
      .catch(() => setWorkflows([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <Label>Target Workflow</Label>
        {loading ? (
          <div className="text-xs text-muted-foreground py-1">Loading active workflows…</div>
        ) : (
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={config.targetWorkflowId ?? ""}
            onChange={(e) => onChange({ targetWorkflowId: e.target.value })}
          >
            <option value="">— Select a workflow —</option>
            {workflows.map((wf) => (
              <option key={wf.id} value={wf.id}>
                {wf.name}
              </option>
            ))}
          </select>
        )}
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Only active workflows with a Workflow Trigger In node appear here.
        </p>
      </div>

      <div>
        <Label>Payload (JSON, optional)</Label>
        <TemplateTextarea
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
          value={config.payload ?? ""}
          onChange={(v) => onChange({ payload: v || undefined })}
          placeholder={'{"key": "{{input.value}}"}'}
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">
          JSON object forwarded to the target workflow as its trigger payload.
        </p>
      </div>
    </div>
  );
}
