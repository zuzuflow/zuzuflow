import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { TriggerOutputConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function TriggerOutputNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as TriggerOutputConfig;
  const bodyPreview = cfg.body
    ? cfg.body.length > 60 ? cfg.body.slice(0, 57) + "..." : cfg.body
    : "—";

  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="space-y-1">
        <p className="text-[10px] text-slate-500">Returns data to trigger caller</p>
        <code className="block bg-slate-900 rounded px-2 py-1 text-[10px] font-mono text-indigo-300 leading-relaxed truncate">
          {bodyPreview}
        </code>
      </div>
    </NodeWrapper>
  );
}
