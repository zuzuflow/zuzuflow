import React from "react";
import type { AwsEventBridgeConfig } from "@workflow/shared";
import { AwsBaseFields } from "./AwsBaseFields";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Label } from "../../ui/label";

interface Props {
  config: AwsEventBridgeConfig;
  onChange: (patch: Partial<AwsEventBridgeConfig>) => void;
}

export function AwsEventBridgeForm({ config, onChange }: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <AwsBaseFields config={config} onChange={onChange} />

      <div>
        <Label>Event Bus Name (optional)</Label>
        <TemplateInput
          value={config.eventBusName ?? ""}
          onChange={(v) => onChange({ eventBusName: v || undefined })}
          placeholder="default"
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">Leave empty for default event bus</p>
      </div>

      <div>
        <Label>Source</Label>
        <TemplateInput
          value={config.source ?? ""}
          onChange={(v) => onChange({ source: v })}
          placeholder="com.myapp.workflow"
        />
      </div>

      <div>
        <Label>Detail Type</Label>
        <TemplateInput
          value={config.detailType ?? ""}
          onChange={(v) => onChange({ detailType: v })}
          placeholder="WorkflowCompleted"
        />
      </div>

      <div>
        <Label>Detail (JSON)</Label>
        <TemplateTextarea
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
          value={config.detail ?? ""}
          onChange={(v) => onChange({ detail: v })}
          placeholder='{"action": "{{input.action}}", "status": "completed"}'
        />
      </div>
    </div>
  );
}
