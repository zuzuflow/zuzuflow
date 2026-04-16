import React from "react";
import type { CryptoHashConfig } from "@workflow/shared";
import { TemplateInput } from "../TemplateInput";
import { Label } from "../../ui/label";

interface Props {
  config: CryptoHashConfig;
  onChange: (patch: Partial<CryptoHashConfig>) => void;
}

export function CryptoHashForm({ config, onChange }: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <div>
        <Label>Algorithm</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={config.algorithm ?? "sha256"}
          onChange={(e) => onChange({ algorithm: e.target.value as CryptoHashConfig["algorithm"] })}
        >
          <option value="sha256">SHA-256</option>
          <option value="sha1">SHA-1</option>
          <option value="md5">MD5</option>
        </select>
      </div>

      <div>
        <Label>Input</Label>
        <TemplateInput
          value={config.input ?? ""}
          onChange={(v) => onChange({ input: v })}
          placeholder="{{input.password}}"
        />
      </div>

      <div>
        <Label>Output Encoding</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={config.encoding ?? "hex"}
          onChange={(e) => onChange({ encoding: e.target.value as CryptoHashConfig["encoding"] })}
        >
          <option value="hex">Hex</option>
          <option value="base64">Base64</option>
        </select>
      </div>
    </div>
  );
}
