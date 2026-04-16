import React from "react";
import type { SshTerminalConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: SshTerminalConfig;
  onChange: (patch: Partial<SshTerminalConfig>) => void;
}

export function SshTerminalForm({ config, onChange }: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_80px] gap-3">
        <div>
          <Label>Host</Label>
          <TemplateInput
            value={config.host ?? ""}
            onChange={(v) => onChange({ host: v })}
            placeholder="192.168.1.1 or myserver.com"
          />
        </div>
        <div>
          <Label>Port</Label>
          <Input
            type="number"
            min={1}
            max={65535}
            value={config.port ?? 22}
            onChange={(e) => onChange({ port: parseInt(e.target.value, 10) || 22 })}
          />
        </div>
      </div>

      <div>
        <Label>Username</Label>
        <TemplateInput
          value={config.username ?? ""}
          onChange={(v) => onChange({ username: v })}
          placeholder="ubuntu"
        />
      </div>

      <CredentialSelector
        kinds={["ssh"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="SSH Credential"
        placeholder="— Use inline password / key —"
      />

      {!config.credentialId && (
        <div>
          <Label>Password (fallback)</Label>
          <Input
            type="password"
            value={config.password ?? ""}
            onChange={(e) => onChange({ password: e.target.value || undefined })}
            placeholder="Leave blank to use private key"
          />
        </div>
      )}

      <div>
        <Label>Command</Label>
        <TemplateTextarea
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
          value={config.command ?? ""}
          onChange={(v) => onChange({ command: v })}
          placeholder="ls -la /var/log"
        />
      </div>

      <div>
        <Label>Timeout (seconds)</Label>
        <Input
          type="number"
          min={1}
          max={300}
          value={config.timeout ?? 30}
          onChange={(e) => onChange({ timeout: parseInt(e.target.value, 10) || 30 })}
        />
      </div>
    </div>
  );
}
