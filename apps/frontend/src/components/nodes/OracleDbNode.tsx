import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { OracleDbConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function OracleDbNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as OracleDbConfig;
  const preview = (cfg.query ?? "").split("\n")[0].slice(0, 40);
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="text-[10px] text-slate-300">
        <span className="font-mono">{preview || "SELECT …"}</span>
      </div>
    </NodeWrapper>
  );
}
