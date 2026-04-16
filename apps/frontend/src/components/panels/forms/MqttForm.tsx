import React from "react";
import type { MqttConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface MqttFormProps {
  config: MqttConfig;
  onChange: (patch: Partial<MqttConfig>) => void;
}

export function MqttForm({ config, onChange }: MqttFormProps): React.ReactElement {
  return (
    <div className="space-y-4">
      <div>
        <Label>Broker URL</Label>
        <TemplateInput
          value={config.brokerUrl}
          onChange={(v) => onChange({ brokerUrl: v })}
          placeholder="mqtt://broker.hivemq.com:1883"
        />
      </div>

      <div>
        <Label>Topic</Label>
        <TemplateInput
          value={config.topic}
          onChange={(v) => onChange({ topic: v })}
          placeholder="sensors/temperature"
        />
      </div>

      <div>
        <Label>QoS Level</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={config.qos}
          onChange={(e) => onChange({ qos: Number(e.target.value) as 0 | 1 | 2 })}
        >
          <option value={0}>0 — At most once</option>
          <option value={1}>1 — At least once</option>
          <option value={2}>2 — Exactly once</option>
        </select>
      </div>

      <div>
        <Label>Client ID (optional)</Label>
        <Input
          type="text"
          value={config.clientId ?? ""}
          onChange={(e) => onChange({ clientId: e.target.value || undefined })}
          placeholder="Auto-generated"
        />
      </div>

      <div>
        <Label>Username (optional)</Label>
        <Input
          type="text"
          value={config.username ?? ""}
          onChange={(e) => onChange({ username: e.target.value || undefined })}
          placeholder="mqtt-user"
        />
      </div>

      <CredentialSelector
        kinds={["mqtt"]}
        value={config.passwordCredentialId}
        onChange={(id) => onChange({ passwordCredentialId: id })}
        label="MQTT Credential (optional)"
        placeholder="— Use inline username above —"
      />
    </div>
  );
}
