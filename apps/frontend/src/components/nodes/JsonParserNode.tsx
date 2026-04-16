import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { JsonParserConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function JsonParserNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as JsonParserConfig;
  const preview = cfg.input?.slice(0, 40) ?? "";
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="font-mono text-[10px] text-slate-300 truncate">
        {preview || <span className="text-slate-500 italic">no input</span>}
      </div>
    </NodeWrapper>
  );
}
