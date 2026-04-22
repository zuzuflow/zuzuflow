import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { SquareConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function SquareNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as SquareConfig;
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
          {cfg.operation ?? "payments.create"}
        </span>
        {cfg.amountMinor && (
          <span className="text-slate-500">
            {" "}
            · {cfg.amountMinor} {(cfg.currency ?? "USD").toUpperCase()}
          </span>
        )}
      </div>
    </NodeWrapper>
  );
}
