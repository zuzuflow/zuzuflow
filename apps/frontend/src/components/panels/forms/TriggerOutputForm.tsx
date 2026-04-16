import React from "react";
import type { TriggerOutputConfig } from "@workflow/shared";
import { TemplateTextarea } from "../TemplateTextarea";
import { Label } from "../../ui/label";

interface Props {
  config: TriggerOutputConfig;
  onChange: (patch: Partial<TriggerOutputConfig>) => void;
}

export function TriggerOutputForm({ config, onChange }: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <div>
        <Label>Response Body</Label>
        <p className="text-[10px] text-muted-foreground mb-2">
          JSON data returned to the trigger caller via <code className="font-mono">triggerAndWait()</code>.
          Use <code className="font-mono">{"{{node_id.field}}"}</code> to reference previous node outputs.
        </p>
        <TemplateTextarea
          className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
          value={config.body ?? ""}
          onChange={(v) => onChange({ body: v || undefined })}
          placeholder='{"success": true, "data": {{js_runner.output}}}'
        />
      </div>
    </div>
  );
}
