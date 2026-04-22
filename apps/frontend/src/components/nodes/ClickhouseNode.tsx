import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { ClickhouseConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function ClickhouseNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as ClickhouseConfig;
  return (
    <NodeWrapper
      nodeId={id}
      kind={data.kind}
      label={data.label}
      selected={selected}
      style={data.style}
    >
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "query"}</span>
        {cfg.table && <span className="text-slate-500"> · {cfg.table}</span>}
      </div>
    </NodeWrapper>
  );
}
