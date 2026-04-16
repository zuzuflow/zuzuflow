import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { ResponseConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function ResponseNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as ResponseConfig;
  const statusCode = cfg.statusCode ?? 200;
  const statusClass =
    statusCode >= 200 && statusCode < 300
      ? "bg-green-800/60 text-green-300"
      : statusCode >= 400
        ? "bg-red-800/60 text-red-300"
        : "bg-amber-800/60 text-amber-300";
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="flex items-center gap-1.5">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${statusClass}`}>
          {statusCode}
        </span>
        <span className="text-[10px] text-slate-400">
          {cfg.contentType ?? "application/json"}
        </span>
      </div>
    </NodeWrapper>
  );
}
