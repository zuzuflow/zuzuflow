import React from "react";
import type { LoopConfig } from "@workflow/shared";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: LoopConfig;
  onChange: (patch: Partial<LoopConfig>) => void;
}

export function LoopForm({ config, onChange }: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <div>
        <Label>Items (expression resolving to array)</Label>
        <TemplateTextarea
          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
          value={config.items ?? ""}
          onChange={(v) => onChange({ items: v })}
          placeholder="{{steps.fetchUsers.output.users}}"
        />
      </div>

      <div>
        <Label>Max Iterations</Label>
        <Input
          type="number"
          value={config.maxIterations ?? 1000}
          onChange={(e) => onChange({ maxIterations: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="1000"
        />
      </div>

      <div>
        <Label>Item Variable Name</Label>
        <Input
          value={config.itemVariable ?? "item"}
          onChange={(e) => onChange({ itemVariable: e.target.value || undefined })}
          placeholder="item"
        />
      </div>

      <div>
        <Label>Index Variable Name</Label>
        <Input
          value={config.indexVariable ?? "index"}
          onChange={(e) => onChange({ indexVariable: e.target.value || undefined })}
          placeholder="index"
        />
      </div>
    </div>
  );
}
