import React from "react";
import type { AwsSnsConfig } from "@workflow/shared";
import { AwsBaseFields } from "./AwsBaseFields";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Label } from "../../ui/label";

interface Props {
  config: AwsSnsConfig;
  onChange: (patch: Partial<AwsSnsConfig>) => void;
}

export function AwsSnsForm({ config, onChange }: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <AwsBaseFields config={config} onChange={onChange} />

      <div>
        <Label>Topic ARN</Label>
        <TemplateInput
          value={config.topicArn ?? ""}
          onChange={(v) => onChange({ topicArn: v })}
          placeholder="arn:aws:sns:us-east-1:123456:my-topic"
        />
      </div>

      <div>
        <Label>Subject (optional)</Label>
        <TemplateInput
          value={config.subject ?? ""}
          onChange={(v) => onChange({ subject: v || undefined })}
          placeholder="Notification subject"
        />
      </div>

      <div>
        <Label>Message</Label>
        <TemplateTextarea
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
          value={config.message ?? ""}
          onChange={(v) => onChange({ message: v })}
          placeholder="{{input.message}}"
        />
      </div>
    </div>
  );
}
