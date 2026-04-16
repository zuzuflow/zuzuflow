import React from "react";
import type { SubflowOutputConfig } from "@workflow/shared";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: SubflowOutputConfig;
  onChange: (patch: Partial<SubflowOutputConfig>) => void;
}

export function SubflowOutputForm({ config, onChange }: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <div>
        <Label>Output Index (0-based)</Label>
        <Input
          type="number"
          min={0}
          value={config.outputIndex ?? 0}
          onChange={(e) => onChange({ outputIndex: Math.max(0, Number(e.target.value)) })}
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">
          0 = first output handle on the parent subworkflow_call node, 1 = second, etc.
        </p>
      </div>
      <div>
        <Label>Label (optional)</Label>
        <Input
          type="text"
          value={config.label ?? ""}
          placeholder="e.g. success, error, timeout"
          onChange={(e) => onChange({ label: e.target.value || undefined })}
        />
      </div>
    </div>
  );
}
