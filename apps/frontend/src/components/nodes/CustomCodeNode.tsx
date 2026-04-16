import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { CustomCodeConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function CustomCodeNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as CustomCodeConfig;
  const firstLine = cfg.code.split("\n").find((l) => l.trim().length > 0) ?? "";
  const preview = firstLine.length > 45 ? firstLine.slice(0, 42) + "..." : firstLine;

  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="px-1.5 py-0.5 rounded bg-rose-900 text-rose-300 text-[10px] font-bold">
          TypeScript
        </span>
      </div>
      <div className="font-mono text-[10px] text-slate-400">{preview}</div>
    </NodeWrapper>
  );
}
