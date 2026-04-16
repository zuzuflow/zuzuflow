import React, { useState } from "react";
import type { TwilioEmailConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: TwilioEmailConfig;
  onChange: (patch: Partial<TwilioEmailConfig>) => void;
}

export function TwilioEmailForm({ config, onChange }: Props): React.ReactElement {
  const [useHtml, setUseHtml] = useState(!!config.htmlBody);

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["sendgrid"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id, apiKey: id ? undefined : config.apiKey })}
        label="SendGrid Credential"
        placeholder="— Use inline API key —"
      />

      {!config.credentialId && (
        <div>
          <Label>SendGrid API Key</Label>
          <Input
            type="password"
            value={config.apiKey ?? ""}
            onChange={(e) => onChange({ apiKey: e.target.value || undefined })}
            placeholder="SG.xxxxxxxx"
          />
        </div>
      )}

      <div>
        <Label>From</Label>
        <TemplateInput
          value={config.from ?? ""}
          onChange={(v) => onChange({ from: v })}
          placeholder="noreply@example.com"
        />
      </div>

      <div>
        <Label>To</Label>
        <TemplateInput
          value={config.to ?? ""}
          onChange={(v) => onChange({ to: v })}
          placeholder="{{input.email}}"
        />
      </div>

      <div>
        <Label>Subject</Label>
        <TemplateInput
          value={config.subject ?? ""}
          onChange={(v) => onChange({ subject: v })}
          placeholder="Welcome to {{input.appName}}"
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
            placeholder="Plain text email body"
          />
        )}
      </div>
    </div>
  );
}
