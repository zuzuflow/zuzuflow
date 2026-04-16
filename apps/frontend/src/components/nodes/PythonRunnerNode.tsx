import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { PythonRunnerConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function PythonRunnerNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as PythonRunnerConfig;
  const preview = cfg.code?.replace(/\s+/g, " ").trim() ?? "";
  const truncated = preview.length > 60 ? preview.slice(0, 57) + "..." : preview;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="font-mono text-[10px] text-slate-300 break-all">
        {truncated || <span className="text-slate-500 italic">no code</span>}
      </div>
    </NodeWrapper>
  );
}
