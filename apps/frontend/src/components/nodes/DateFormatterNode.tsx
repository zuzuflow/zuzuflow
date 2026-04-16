import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { DateFormatterConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function DateFormatterNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as DateFormatterConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="text-[10px] text-slate-300 font-mono">
        {cfg.outputFormat || <span className="text-slate-500 italic">no format</span>}
      </div>
      {cfg.timezone && cfg.timezone !== "UTC" && (
        <div className="text-[10px] text-slate-500">{cfg.timezone}</div>
      )}
    </NodeWrapper>
  );
}
