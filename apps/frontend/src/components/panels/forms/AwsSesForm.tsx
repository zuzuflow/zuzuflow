import React from "react";
import type { AwsSesConfig } from "@workflow/shared";
import { AwsBaseFields } from "./AwsBaseFields";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Label } from "../../ui/label";

interface Props {
  config: AwsSesConfig;
  onChange: (patch: Partial<AwsSesConfig>) => void;
}

const OPERATIONS: AwsSesConfig["operation"][] = ["sendEmail", "sendTemplatedEmail", "sendRawEmail"];

export function AwsSesForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "sendEmail";

  return (
    <div className="space-y-4">
      <AwsBaseFields config={config} onChange={onChange} />

      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={op}
          onChange={(e) => onChange({ operation: e.target.value as AwsSesConfig["operation"] })}
        >
          {OPERATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {op !== "sendRawEmail" && (
        <>
          <div>
            <Label>From</Label>
            <TemplateInput
              value={config.from ?? ""}
              onChange={(v) => onChange({ from: v })}
              placeholder="noreply@example.com"
            />
          </div>
          <div>
            <Label>To (comma-separated)</Label>
            <TemplateInput
              value={config.to ?? ""}
              onChange={(v) => onChange({ to: v })}
              placeholder="user@example.com, {{input.email}}"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>CC</Label>
              <TemplateInput
                value={config.cc ?? ""}
                onChange={(v) => onChange({ cc: v || undefined })}
                placeholder="cc@example.com"
              />
            </div>
            <div>
              <Label>BCC</Label>
              <TemplateInput
                value={config.bcc ?? ""}
                onChange={(v) => onChange({ bcc: v || undefined })}
                placeholder="bcc@example.com"
              />
            </div>
          </div>
        </>
      )}

      {op === "sendEmail" && (
        <>
          <div>
            <Label>Subject</Label>
            <TemplateInput
              value={config.subject ?? ""}
              onChange={(v) => onChange({ subject: v || undefined })}
              placeholder="Notification"
            />
          </div>
          <div>
            <Label>Text Body</Label>
            <TemplateTextarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
              value={config.textBody ?? ""}
              onChange={(v) => onChange({ textBody: v || undefined })}
              placeholder="Plain text content"
            />
          </div>
          <div>
            <Label>HTML Body</Label>
            <TemplateTextarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
              value={config.htmlBody ?? ""}
              onChange={(v) => onChange({ htmlBody: v || undefined })}
              placeholder="<h1>Hello {{input.name}}</h1>"
            />
          </div>
        </>
      )}

      {op === "sendTemplatedEmail" && (
        <>
          <div>
            <Label>Template Name</Label>
            <TemplateInput
              value={config.templateName ?? ""}
              onChange={(v) => onChange({ templateName: v || undefined })}
              placeholder="MyEmailTemplate"
            />
          </div>
          <div>
            <Label>Template Data (JSON)</Label>
            <TemplateTextarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
              value={config.templateData ?? ""}
              onChange={(v) => onChange({ templateData: v || undefined })}
              placeholder='{"name": "{{input.name}}"}'
            />
          </div>
        </>
      )}

      {op === "sendRawEmail" && (
        <div>
          <Label>Raw MIME Message</Label>
          <TemplateTextarea
            className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
            value={config.rawMessage ?? ""}
            onChange={(v) => onChange({ rawMessage: v || undefined })}
            placeholder="From: sender@example.com&#10;To: recipient@example.com&#10;Subject: Test&#10;..."
          />
        </div>
      )}
    </div>
  );
}
