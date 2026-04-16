import React from "react";
import type { Base64Config } from "@workflow/shared";
import { TemplateInput } from "../TemplateInput";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: Base64Config;
  onChange: (patch: Partial<Base64Config>) => void;
}

export function Base64Form({ config, onChange }: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={config.operation ?? "encode"}
          onChange={(e) => onChange({ operation: e.target.value as Base64Config["operation"] })}
        >
          <option value="encode">Encode (text → Base64)</option>
          <option value="decode">Decode (Base64 → text)</option>
        </select>
      </div>

      <div>
        <Label>Input</Label>
        <TemplateInput
          value={config.input ?? ""}
          onChange={(v) => onChange({ input: v })}
          placeholder="{{input.data}}"
        />
      </div>
    </div>
  );
}
