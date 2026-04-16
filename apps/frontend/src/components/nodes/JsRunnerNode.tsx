import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { JsRunnerConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function JsRunnerNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as JsRunnerConfig;
  const preview = cfg.expression?.replace(/\s+/g, " ").trim() ?? "";
  const truncated = preview.length > 45 ? preview.slice(0, 42) + "..." : preview;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="font-mono text-[10px] text-slate-300 break-all">
        {truncated || <span className="text-slate-500 italic">no expression</span>}
      </div>
    </NodeWrapper>
  );
}
