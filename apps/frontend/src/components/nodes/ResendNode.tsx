import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { ResendConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function ResendNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as ResendConfig;
  return (
    <NodeWrapper
      nodeId={id}
      kind={data.kind}
      label={data.label}
      selected={selected}
      style={data.style}
    >
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "emails.send"}</span>
        {cfg.to && <span className="text-slate-500"> → {cfg.to}</span>}
      </div>
    </NodeWrapper>
  );
}
