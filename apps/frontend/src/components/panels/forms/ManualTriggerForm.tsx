import React from "react";
import type {
  ManualTriggerConfig,
  ManualTriggerValueType,
} from "@workflow/shared";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface ManualTriggerFormProps {
  config: ManualTriggerConfig;
  onChange: (patch: Partial<ManualTriggerConfig>) => void;
}

const TYPE_OPTIONS: {
  value: ManualTriggerValueType;
  label: string;
  hint: string;
}[] = [
  {
    value: "json",
    label: "JSON",
    hint: "Any object / array — parsed at run time, falls back to raw string if invalid",
  },
  { value: "string", label: "String", hint: "Plain text, passed through as-is" },
  { value: "number", label: "Number", hint: "Parsed with parseFloat" },
  {
    value: "boolean",
    label: "Boolean",
    hint: "true / false (case-insensitive)",
  },
];

function validate(
  value: string,
  type: ManualTriggerValueType,
): string | null {
  if (!value.trim()) return null;
  switch (type) {
    case "json":
      try {
        JSON.parse(value);
        return null;
      } catch {
        return "Invalid JSON";
      }
    case "number":
      return Number.isFinite(Number(value)) ? null : "Not a valid number";
    case "boolean":
      return /^(true|false)$/i.test(value.trim())
        ? null
        : 'Must be "true" or "false"';
    default:
      return null;
  }
}

export function ManualTriggerForm({
  config,
  onChange,
}: ManualTriggerFormProps): React.ReactElement {
  const type = config.valueType ?? "json";
  const value = config.value ?? "";
  const error = validate(value, type);
  const activeHint = TYPE_OPTIONS.find((t) => t.value === type)?.hint;

  return (
    <div className="space-y-4">
      <div>
        <Label>Input type</Label>
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ valueType: opt.value })}
              className={`px-2 py-1.5 text-[11px] font-medium rounded-md border transition-colors ${
                type === opt.value
                  ? "bg-violet-600 border-violet-500 text-white"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {activeHint && (
          <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
            {activeHint}
          </p>
        )}
      </div>

      <div>
        <Label>Input value</Label>
        {type === "boolean" ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange({ value: "true" })}
              className={`flex-1 px-2 py-1.5 text-xs rounded-md border transition-colors ${
                value.trim().toLowerCase() === "true"
                  ? "bg-emerald-700 border-emerald-600 text-white"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              true
            </button>
            <button
              type="button"
              onClick={() => onChange({ value: "false" })}
              className={`flex-1 px-2 py-1.5 text-xs rounded-md border transition-colors ${
                value.trim().toLowerCase() === "false"
                  ? "bg-rose-700 border-rose-600 text-white"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              false
            </button>
          </div>
        ) : type === "json" ? (
          <textarea
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            rows={8}
            value={value}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder='{ "userId": "123", "action": "test" }'
          />
        ) : (
          <Input
            type={type === "number" ? "number" : "text"}
            value={value}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder={
              type === "number" ? "42" : "your-value-here"
            }
          />
        )}
        {error && (
          <p className="text-[10px] text-red-400 mt-1">{error}</p>
        )}
      </div>

      <div className="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-[10px] text-muted-foreground leading-relaxed">
        When the workflow is started, this value is coerced by its type and
        becomes the trigger's output. An explicit payload passed to the
        <code className="mx-1 text-slate-300">POST /executions/start</code>
        endpoint overrides it.
      </div>
    </div>
  );
}
