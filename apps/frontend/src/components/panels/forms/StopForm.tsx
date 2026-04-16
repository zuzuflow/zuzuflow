import React from "react";
import type { StopConfig } from "@workflow/shared";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: StopConfig;
  onChange: (patch: Partial<StopConfig>) => void;
}

export function StopForm({ config, onChange }: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-orange-900/30 border border-orange-700/50 rounded-md">
        <p className="text-xs text-orange-300 font-medium">Stop / Terminator</p>
        <p className="text-[11px] text-orange-400 mt-1">
          Execution stops at this node. Downstream nodes are not visited.
        </p>
      </div>
      <div>
        <Label>Message (optional)</Label>
        <Input
          value={config.message ?? ""}
          onChange={(e) => onChange({ message: e.target.value || undefined })}
          placeholder="Workflow stopped"
        />
      </div>
    </div>
  );
}
