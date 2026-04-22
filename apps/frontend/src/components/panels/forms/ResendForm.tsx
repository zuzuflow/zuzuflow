import React from "react";
import type { ResendConfig, ResendOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Label } from "../../ui/label";

interface Props {
  config: ResendConfig;
  onChange: (patch: Partial<ResendConfig>) => void;
}

const OPERATIONS: ResendOperation[] = ["emails.send", "emails.get"];

export function ResendForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "emails.send";
  const isSend = op === "emails.send";
  const isGet = op === "emails.get";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["resend"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Resend Credential"
        placeholder="— API key (re_...) —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as ResendOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {isGet && (
        <div>
          <Label>Email ID</Label>
          <TemplateInput
            value={config.emailId ?? ""}
            onChange={(v) => onChange({ emailId: v })}
            placeholder="e.g. 4ef9a..."
          />
        </div>
      )}
      {isSend && (
        <>
          <div>
            <Label>From</Label>
            <TemplateInput
              value={config.from ?? ""}
              onChange={(v) => onChange({ from: v })}
              placeholder="Acme <noreply@yourdomain.com>"
            />
          </div>
          <div>
            <Label>To (CSV)</Label>
            <TemplateInput
              value={config.to ?? ""}
              onChange={(v) => onChange({ to: v })}
              placeholder="user@example.com, other@example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>CC (CSV, optional)</Label>
              <TemplateInput
                value={config.cc ?? ""}
                onChange={(v) => onChange({ cc: v || undefined })}
                placeholder=""
              />
            </div>
            <div>
              <Label>BCC (CSV, optional)</Label>
              <TemplateInput
                value={config.bcc ?? ""}
                onChange={(v) => onChange({ bcc: v || undefined })}
                placeholder=""
              />
            </div>
          </div>
          <div>
            <Label>Reply-To (optional)</Label>
            <TemplateInput
              value={config.replyTo ?? ""}
              onChange={(v) => onChange({ replyTo: v || undefined })}
              placeholder="support@example.com"
            />
          </div>
          <div>
            <Label>Subject</Label>
            <TemplateInput
              value={config.subject ?? ""}
              onChange={(v) => onChange({ subject: v })}
              placeholder="Your order has shipped"
            />
          </div>
          <div>
            <Label>HTML body</Label>
            <TemplateTextarea
              value={config.html ?? ""}
              onChange={(v) => onChange({ html: v || undefined })}
              placeholder="<p>HTML body...</p>"
              rows={4}
            />
          </div>
          <div>
            <Label>Text body</Label>
            <TemplateTextarea
              value={config.text ?? ""}
              onChange={(v) => onChange({ text: v || undefined })}
              placeholder="Plain-text body..."
              rows={3}
            />
          </div>
          <div>
            <Label>Tags JSON array (optional)</Label>
            <TemplateTextarea
              value={config.tags ?? ""}
              onChange={(v) => onChange({ tags: v || undefined })}
              placeholder='[{"name":"category","value":"order"}]'
              rows={2}
            />
          </div>
        </>
      )}
    </div>
  );
}
