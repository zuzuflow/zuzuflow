import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { StripeConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

/**
 * Stripe node — payments, customers, subscriptions, invoices.
 */
export function StripeNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as StripeConfig;
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
          {cfg.operation ?? "charges.create"}
        </span>
        {cfg.amount && (
          <span className="text-slate-500">
            {" "}
            · {cfg.amount} {(cfg.currency ?? "usd").toUpperCase()}
          </span>
        )}
        {cfg.resourceId && (
          <span className="text-slate-500"> · {cfg.resourceId}</span>
        )}
      </div>
    </NodeWrapper>
  );
}
