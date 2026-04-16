import React from "react";
import type { WorkflowTriggerInConfig } from "@workflow/shared";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: WorkflowTriggerInConfig;
  onChange: (patch: Partial<WorkflowTriggerInConfig>) => void;
}

export function WorkflowTriggerInForm({ config, onChange }: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-violet-900/30 border border-violet-700/50 rounded-md">
        <p className="text-xs text-violet-300 font-medium">Workflow Trigger In</p>
        <p className="text-[11px] text-violet-400 mt-1">
          This node marks the workflow as callable by other workflows using a Workflow Trigger Out node.
          Activate this workflow so it appears in the target list.
        </p>
      </div>
      <div>
        <Label>Description (optional)</Label>
        <Input
          value={config.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value || undefined })}
          placeholder="What does this workflow do?"
        />
      </div>
    </div>
  );
}
