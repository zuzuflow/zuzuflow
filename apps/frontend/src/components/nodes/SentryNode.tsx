import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { SentryConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function SentryNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as SentryConfig;
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
          {cfg.operation ?? "events.captureMessage"}
        </span>
        {cfg.level && cfg.operation?.startsWith("events.") && (
          <span className="text-slate-500"> · {cfg.level}</span>
        )}
      </div>
    </NodeWrapper>
  );
}
