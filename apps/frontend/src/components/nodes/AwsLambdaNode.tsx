import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { AwsLambdaConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";
import { AwsLambdaIcon } from "../icons/AwsIcons";

export function AwsLambdaNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as AwsLambdaConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style} iconNode={<AwsLambdaIcon size={14} />}>
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "invoke"}</span>
        {cfg.functionName && <span className="text-slate-500"> · {cfg.functionName}</span>}
      </div>
    </NodeWrapper>
  );
}
