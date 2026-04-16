import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { HttpRequestConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-green-700 text-green-200",
  POST: "bg-blue-700 text-blue-200",
  PUT: "bg-amber-700 text-amber-200",
  PATCH: "bg-orange-700 text-orange-200",
  DELETE: "bg-red-700 text-red-200",
  HEAD: "bg-slate-700 text-slate-200",
  OPTIONS: "bg-purple-700 text-purple-200",
};

export function HttpRequestNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as HttpRequestConfig;
  const methodClass = METHOD_COLORS[cfg.method] ?? "bg-slate-700 text-slate-200";
  const url = cfg.url.length > 35 ? cfg.url.slice(0, 32) + "..." : cfg.url;

  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="flex items-center gap-1.5">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${methodClass}`}>
          {cfg.method}
        </span>
        <span className="text-slate-300 truncate font-mono text-[10px]">{url}</span>
      </div>
    </NodeWrapper>
  );
}
