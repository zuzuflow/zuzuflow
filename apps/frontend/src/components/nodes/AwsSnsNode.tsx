import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { AwsSnsConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";
import { AwsSnsIcon } from "../icons/AwsIcons";

export function AwsSnsNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as AwsSnsConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style} iconNode={<AwsSnsIcon size={14} />}>
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "publish"}</span>
        {cfg.topicArn && <span className="text-slate-500"> · {cfg.topicArn.split(":").pop()}</span>}
      </div>
    </NodeWrapper>
  );
}
