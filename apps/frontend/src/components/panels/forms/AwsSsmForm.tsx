import React from "react";
import type { AwsSsmConfig } from "@workflow/shared";
import { AwsBaseFields } from "./AwsBaseFields";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Label } from "../../ui/label";

interface Props {
  config: AwsSsmConfig;
  onChange: (patch: Partial<AwsSsmConfig>) => void;
}

const OPERATIONS: AwsSsmConfig["operation"][] = [
  "getParameter", "putParameter", "getParametersByPath", "deleteParameter",
];

export function AwsSsmForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "getParameter";

  return (
    <div className="space-y-4">
      <AwsBaseFields config={config} onChange={onChange} />

      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={op}
          onChange={(e) => onChange({ operation: e.target.value as AwsSsmConfig["operation"] })}
        >
          {OPERATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      <div>
        <Label>{op === "getParametersByPath" ? "Path Prefix" : "Parameter Name"}</Label>
        <TemplateInput
          value={op === "getParametersByPath" ? (config.path ?? config.name ?? "") : (config.name ?? "")}
          onChange={(v) => op === "getParametersByPath" ? onChange({ path: v, name: v }) : onChange({ name: v })}
          placeholder={op === "getParametersByPath" ? "/myapp/config/" : "/myapp/config/db-host"}
        />
      </div>

      {op === "putParameter" && (
        <>
          <div>
            <Label>Value</Label>
            <TemplateTextarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
              value={config.value ?? ""}
              onChange={(v) => onChange({ value: v || undefined })}
              placeholder="parameter-value"
            />
          </div>
          <div>
            <Label>Type</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={config.type ?? "String"}
              onChange={(e) => onChange({ type: e.target.value as AwsSsmConfig["type"] })}
            >
              <option value="String">String</option>
              <option value="StringList">StringList</option>
              <option value="SecureString">SecureString</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.overwrite ?? true}
                onChange={(e) => onChange({ overwrite: e.target.checked })}
                className="w-3.5 h-3.5 rounded accent-indigo-500"
              />
              <span className="text-xs text-muted-foreground">Overwrite if exists</span>
            </label>
          </div>
        </>
      )}

      {(op === "getParameter" || op === "getParametersByPath") && (
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.withDecryption ?? true}
              onChange={(e) => onChange({ withDecryption: e.target.checked })}
              className="w-3.5 h-3.5 rounded accent-indigo-500"
            />
            <span className="text-xs text-muted-foreground">Decrypt SecureString values</span>
          </label>
        </div>
      )}
    </div>
  );
}
