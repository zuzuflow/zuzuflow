import React from "react";
import type { AwsStepFunctionsConfig } from "@workflow/shared";
import { AwsBaseFields } from "./AwsBaseFields";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Label } from "../../ui/label";

interface Props {
  config: AwsStepFunctionsConfig;
  onChange: (patch: Partial<AwsStepFunctionsConfig>) => void;
}

const OPERATIONS: AwsStepFunctionsConfig["operation"][] = [
  "startExecution", "describeExecution", "stopExecution",
];

export function AwsStepFunctionsForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "startExecution";

  return (
    <div className="space-y-4">
      <AwsBaseFields config={config} onChange={onChange} />

      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={op}
          onChange={(e) => onChange({ operation: e.target.value as AwsStepFunctionsConfig["operation"] })}
        >
          {OPERATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {op === "startExecution" && (
        <>
          <div>
            <Label>State Machine ARN</Label>
            <TemplateInput
              value={config.stateMachineArn ?? ""}
              onChange={(v) => onChange({ stateMachineArn: v })}
              placeholder="arn:aws:states:us-east-1:123456:stateMachine:my-sm"
            />
          </div>
          <div>
            <Label>Execution Name (optional)</Label>
            <TemplateInput
              value={config.executionName ?? ""}
              onChange={(v) => onChange({ executionName: v || undefined })}
              placeholder="auto-generated if empty"
            />
          </div>
          <div>
            <Label>Input (JSON)</Label>
            <TemplateTextarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
              value={config.input ?? ""}
              onChange={(v) => onChange({ input: v || undefined })}
              placeholder='{"key": "{{input.value}}"}'
            />
          </div>
        </>
      )}

      {(op === "describeExecution" || op === "stopExecution") && (
        <div>
          <Label>Execution ARN</Label>
          <TemplateInput
            value={config.executionArn ?? ""}
            onChange={(v) => onChange({ executionArn: v || undefined })}
            placeholder="arn:aws:states:us-east-1:123456:execution:my-sm:exec-id"
          />
        </div>
      )}

      {op === "stopExecution" && (
        <div>
          <Label>Cause (reason)</Label>
          <TemplateInput
            value={config.cause ?? ""}
            onChange={(v) => onChange({ cause: v || undefined })}
            placeholder="Stopped by workflow"
          />
        </div>
      )}
    </div>
  );
}
