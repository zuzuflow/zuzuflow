import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { AwsStepFunctionsConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";
import { AwsStepFunctionsIcon } from "../icons/AwsIcons";

export function AwsStepFunctionsNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as AwsStepFunctionsConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style} iconNode={<AwsStepFunctionsIcon size={14} />}>
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "startExecution"}</span>
        {cfg.stateMachineArn && <span className="text-slate-500"> · {cfg.stateMachineArn.split(":").pop()}</span>}
      </div>
    </NodeWrapper>
  );
}
