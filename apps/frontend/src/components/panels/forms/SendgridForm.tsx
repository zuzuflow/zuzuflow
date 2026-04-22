import React from "react";
import type { SendgridConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: SendgridConfig;
  onChange: (patch: Partial<SendgridConfig>) => void;
}

export function SendgridForm({
  config,
  onChange,
}: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["sendgrid"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="SendGrid Credential"
        placeholder="— API key (SG....) —"
      />

      <p className="text-[10px] text-muted-foreground">
        Operation: <code>mail.send</code> (the only op this node exposes).
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>From email</Label>
          <TemplateInput
            value={config.from ?? ""}
            onChange={(v) => onChange({ from: v })}
            placeholder="noreply@example.com"
          />
        </div>
        <div>
          <Label>From name (optional)</Label>
          <TemplateInput
            value={config.fromName ?? ""}
            onChange={(v) => onChange({ fromName: v })}
            placeholder="ZuzuFlow"
          />
        </div>
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
        <Label>Text body</Label>
        <TemplateTextarea
          value={config.text ?? ""}
          onChange={(v) => onChange({ text: v || undefined })}
          placeholder="Plain-text body..."
          rows={4}
        />
      </div>

      <div>
        <Label>HTML body</Label>
        <TemplateTextarea
          value={config.html ?? ""}
          onChange={(v) => onChange({ html: v || undefined })}
          placeholder="<p>HTML body</p>"
          rows={4}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Dynamic Template ID (optional)</Label>
          <Input
            value={config.templateId ?? ""}
            onChange={(e) =>
              onChange({ templateId: e.target.value || undefined })
            }
            placeholder="d-..."
          />
        </div>
        <div>
          <Label>Send at (Unix timestamp, optional)</Label>
          <TemplateInput
            value={config.sendAt ?? ""}
            onChange={(v) => onChange({ sendAt: v || undefined })}
            placeholder="1700000000"
          />
        </div>
      </div>

      <div>
        <Label>Dynamic Template Data JSON (optional)</Label>
        <TemplateTextarea
          value={config.dynamicTemplateData ?? ""}
          onChange={(v) =>
            onChange({ dynamicTemplateData: v || undefined })
          }
          placeholder='{"name":"Ada","orderId":"{{input.orderId}}"}'
          rows={3}
        />
      </div>

      <div>
        <Label>Categories CSV (optional)</Label>
        <TemplateInput
          value={config.categories ?? ""}
          onChange={(v) => onChange({ categories: v || undefined })}
          placeholder="transactional,order-shipped"
        />
      </div>
    </div>
  );
}
