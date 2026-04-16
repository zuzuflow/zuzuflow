import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { AwsSqsConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";
import { AwsSqsIcon } from "../icons/AwsIcons";

export function AwsSqsNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as AwsSqsConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style} iconNode={<AwsSqsIcon size={14} />}>
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "sendMessage"}</span>
        {cfg.queueUrl && <span className="text-slate-500"> · {cfg.queueUrl.split("/").pop()}</span>}
      </div>
    </NodeWrapper>
  );
}
