import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { PagerDutyConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function PagerDutyNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as PagerDutyConfig;
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
          {cfg.operation ?? "events.trigger"}
        </span>
        {cfg.severity && (
          <span className="text-slate-500"> · {cfg.severity}</span>
        )}
      </div>
    </NodeWrapper>
  );
}
