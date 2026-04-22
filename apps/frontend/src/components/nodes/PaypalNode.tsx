import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { PaypalConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function PaypalNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as PaypalConfig;
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
          {cfg.operation ?? "orders.create"}
        </span>
        {cfg.amount && (
          <span className="text-slate-500">
            {" "}
            · {cfg.amount} {(cfg.currency ?? "USD").toUpperCase()}
          </span>
        )}
        {cfg.resourceId && (
          <span className="text-slate-500"> · {cfg.resourceId.slice(0, 12)}…</span>
        )}
      </div>
    </NodeWrapper>
  );
}
