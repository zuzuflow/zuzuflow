import React from "react";
import type { TwilioSmsConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: TwilioSmsConfig;
  onChange: (patch: Partial<TwilioSmsConfig>) => void;
}

export function TwilioSmsForm({ config, onChange }: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["twilio"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Twilio Credential"
        placeholder="— Use inline Account SID / Auth Token —"
      />

      {!config.credentialId && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Account SID</Label>
            <Input
              value={config.accountSid ?? ""}
              onChange={(e) => onChange({ accountSid: e.target.value || undefined })}
              placeholder="ACxxxxxxxx"
            />
          </div>
          <div>
            <Label>Auth Token</Label>
            <Input
              type="password"
              value={config.authToken ?? ""}
              onChange={(e) => onChange({ authToken: e.target.value || undefined })}
              placeholder="••••••••"
            />
          </div>
        </div>
      )}

      <div>
        <Label>From (Twilio number)</Label>
        <TemplateInput
          value={config.from ?? ""}
          onChange={(v) => onChange({ from: v })}
          placeholder="+15551234567"
        />
      </div>

      <div>
        <Label>To</Label>
        <TemplateInput
          value={config.to ?? ""}
          onChange={(v) => onChange({ to: v })}
          placeholder="{{input.phoneNumber}}"
        />
      </div>

      <div>
        <Label>Message</Label>
        <TemplateTextarea
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
          value={config.body ?? ""}
          onChange={(v) => onChange({ body: v })}
          placeholder="Your code is {{input.code}}"
        />
      </div>
    </div>
  );
}
