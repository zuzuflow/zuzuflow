import React, { useState } from "react";
import type { SendEmailConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Label } from "../../ui/label";

interface SendEmailFormProps {
  config: SendEmailConfig;
  onChange: (patch: Partial<SendEmailConfig>) => void;
}

function toStr(val: string | string[] | undefined): string {
  if (!val) return "";
  return Array.isArray(val) ? val.join(", ") : val;
}

function fromStr(val: string): string | string[] {
  const parts = val.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length === 1 ? parts[0] : parts;
}

export function SendEmailForm({ config, onChange }: SendEmailFormProps): React.ReactElement {
  const [useHtml, setUseHtml] = useState(!!config.htmlBody);

  return (
    <div className="space-y-4">
      <div>
        <Label>Provider</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={config.provider}
          onChange={(e) => onChange({ provider: e.target.value as SendEmailConfig["provider"] })}
        >
          <option value="smtp">SMTP</option>
          <option value="sendgrid">SendGrid</option>
        </select>
      </div>

      <div>
        <Label>To</Label>
        <TemplateInput
          value={toStr(config.to)}
          onChange={(v) => onChange({ to: fromStr(v) })}
          placeholder="recipient@example.com"
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">Comma-separated for multiple</p>
      </div>

      <div>
        <Label>CC (optional)</Label>
        <TemplateInput
          value={toStr(config.cc)}
          onChange={(v) => onChange({ cc: v ? fromStr(v) : undefined })}
          placeholder="cc@example.com"
        />
      </div>

      <div>
        <Label>BCC (optional)</Label>
        <TemplateInput
          value={toStr(config.bcc)}
          onChange={(v) => onChange({ bcc: v ? fromStr(v) : undefined })}
          placeholder="bcc@example.com"
        />
      </div>

      <div>
        <Label>Subject</Label>
        <TemplateInput
          value={config.subject}
          onChange={(v) => onChange({ subject: v })}
          placeholder="Your subject line"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="mb-0">Body</Label>
          <button
            type="button"
            onClick={() => setUseHtml((v) => !v)}
            className="text-[10px] text-indigo-400 hover:text-indigo-300"
          >
            {useHtml ? "Switch to plain text" : "Switch to HTML"}
          </button>
        </div>
        {useHtml ? (
          <TemplateTextarea
            className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
            value={config.htmlBody ?? ""}
            onChange={(v) => onChange({ htmlBody: v || undefined, body: undefined })}
            placeholder="<p>Hello {{input.name}}</p>"
          />
        ) : (
          <TemplateTextarea
            className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            value={config.body ?? ""}
            onChange={(v) => onChange({ body: v || undefined, htmlBody: undefined })}
            placeholder="Plain text message body"
          />
        )}
      </div>

      <CredentialSelector
        kinds={config.provider === "sendgrid" ? ["sendgrid"] : ["smtp"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label={config.provider === "sendgrid" ? "SendGrid Credential" : "SMTP Credential"}
        placeholder="— Use environment variables —"
      />
    </div>
  );
}
