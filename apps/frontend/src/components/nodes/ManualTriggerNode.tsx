import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { ManualTriggerConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

const TYPE_BADGE: Record<
  NonNullable<ManualTriggerConfig["valueType"]>,
  { label: string; className: string }
> = {
  string: { label: "string", className: "bg-sky-900 text-sky-200" },
  number: { label: "number", className: "bg-emerald-900 text-emerald-200" },
  boolean: { label: "boolean", className: "bg-amber-900 text-amber-200" },
  json: { label: "json", className: "bg-violet-900 text-violet-200" },
};

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

export function ManualTriggerNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = (data.config ?? {}) as ManualTriggerConfig;
  const type = cfg.valueType ?? "json";
  const badge = TYPE_BADGE[type];
  const hasValue = !!cfg.value && cfg.value.trim().length > 0;

  // Strip newlines for a one-line preview. JSON/object payloads may be
  // multi-line in the editor; show a compact render here.
  const preview = hasValue ? truncate(cfg.value!.replace(/\s+/g, " "), 40) : "";

  return (
    <NodeWrapper
      nodeId={id}
      kind={data.kind}
      label={data.label}
      selected={selected}
      style={data.style}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}
        >
          {badge.label}
        </span>
        {hasValue ? (
          <span className="text-slate-400 text-[10px] font-mono truncate flex-1">
            {preview}
          </span>
        ) : (
          <span className="text-slate-500 text-[10px] italic">no payload</span>
        )}
      </div>
    </NodeWrapper>
  );
}
