import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { AwsEventBridgeConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";
import { AwsEventBridgeIcon } from "../icons/AwsIcons";

export function AwsEventBridgeNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as AwsEventBridgeConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style} iconNode={<AwsEventBridgeIcon size={14} />}>
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">putEvents</span>
        {cfg.source && <span className="text-slate-500"> · {cfg.source}</span>}
      </div>
    </NodeWrapper>
  );
}
