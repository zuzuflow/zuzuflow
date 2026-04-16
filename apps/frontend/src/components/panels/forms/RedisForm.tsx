import React from "react";
import type { RedisConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: RedisConfig;
  onChange: (patch: Partial<RedisConfig>) => void;
}

const OPERATIONS: RedisConfig["operation"][] = ["get", "set", "del", "expire", "exists"];

export function RedisForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "get";
  const showValue = op === "set";
  const showTtl = op === "set" || op === "expire";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["redis"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id, url: id ? undefined : config.url })}
        label="Redis Credential"
        placeholder="— Use inline URL —"
      />

      {!config.credentialId && (
        <div>
          <Label>URL (fallback)</Label>
          <Input
            type="password"
            value={config.url ?? ""}
            onChange={(e) => onChange({ url: e.target.value || undefined })}
            placeholder="redis://localhost:6379"
          />
        </div>
      )}

      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={op}
          onChange={(e) => onChange({ operation: e.target.value as RedisConfig["operation"] })}
        >
          {OPERATIONS.map((o) => <option key={o} value={o}>{o.toUpperCase()}</option>)}
        </select>
      </div>

      <div>
        <Label>Key</Label>
        <TemplateInput
          className="font-mono"
          value={config.key ?? ""}
          onChange={(v) => onChange({ key: v })}
          placeholder="cache:{{input.userId}}"
        />
      </div>

      {showValue && (
        <div>
          <Label>Value</Label>
          <TemplateInput
            value={config.value ?? ""}
            onChange={(v) => onChange({ value: v })}
            placeholder="{{input.data}}"
          />
        </div>
      )}

      {showTtl && (
        <div>
          <Label>TTL (seconds)</Label>
          <Input
            type="number"
            min={1}
            value={config.ttl ?? ""}
            onChange={(e) => onChange({ ttl: parseInt(e.target.value, 10) || undefined })}
            placeholder="3600"
          />
        </div>
      )}
    </div>
  );
}
