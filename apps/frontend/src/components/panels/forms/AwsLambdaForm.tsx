import React from "react";
import type { AwsLambdaConfig } from "@workflow/shared";
import { AwsBaseFields } from "./AwsBaseFields";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Label } from "../../ui/label";

interface Props {
  config: AwsLambdaConfig;
  onChange: (patch: Partial<AwsLambdaConfig>) => void;
}

export function AwsLambdaForm({ config, onChange }: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <AwsBaseFields config={config} onChange={onChange} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Operation</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={config.operation ?? "invoke"}
            onChange={(e) => onChange({ operation: e.target.value as AwsLambdaConfig["operation"] })}
          >
            <option value="invoke">Invoke</option>
            <option value="invokeAsync">Invoke Async</option>
          </select>
        </div>
        <div>
          <Label>Invocation Type</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={config.invocationType ?? "RequestResponse"}
            onChange={(e) => onChange({ invocationType: e.target.value as AwsLambdaConfig["invocationType"] })}
          >
            <option value="RequestResponse">Request/Response</option>
            <option value="Event">Event (async)</option>
            <option value="DryRun">Dry Run</option>
          </select>
        </div>
      </div>

      <div>
        <Label>Function Name / ARN</Label>
        <TemplateInput
          value={config.functionName ?? ""}
          onChange={(v) => onChange({ functionName: v })}
          placeholder="my-function or arn:aws:lambda:..."
        />
      </div>

      <div>
        <Label>Qualifier (version/alias)</Label>
        <TemplateInput
          value={config.qualifier ?? ""}
          onChange={(v) => onChange({ qualifier: v || undefined })}
          placeholder="$LATEST"
        />
      </div>

      <div>
        <Label>Payload (JSON)</Label>
        <TemplateTextarea
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
          value={config.payload ?? ""}
          onChange={(v) => onChange({ payload: v || undefined })}
          placeholder='{"key": "{{input.value}}"}'
        />
      </div>
    </div>
  );
}
