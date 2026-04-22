import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { MsTeamsConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function MsTeamsNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as MsTeamsConfig;
  return (
    <NodeWrapper
      nodeId={id}
      kind={data.kind}
      label={data.label}
      selected={selected}
      style={data.style}
    >
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">
          {cfg.operation ?? "sendWebhookMessage"}
        </span>
        {cfg.title && <span className="text-slate-500"> · {cfg.title}</span>}
      </div>
    </NodeWrapper>
  );
}
