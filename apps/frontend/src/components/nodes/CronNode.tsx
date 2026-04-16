import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { CronConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function CronNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as CronConfig;

  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="font-mono text-slate-200 text-sm tracking-widest">{cfg.expression}</div>
      <div className="text-slate-500 text-[10px] mt-0.5">{cfg.timezone}</div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-[10px] text-amber-400 font-medium">
          Runs on schedule — use Activate to enable
        </span>
      </div>
      <div className="text-[10px] text-slate-600 mt-0.5">
        &quot;Test Run&quot; executes immediately for testing
      </div>
    </NodeWrapper>
  );
}
