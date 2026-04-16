import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { AwsSecretsManagerConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";
import { AwsSecretsManagerIcon } from "../icons/AwsIcons";

export function AwsSecretsManagerNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as AwsSecretsManagerConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style} iconNode={<AwsSecretsManagerIcon size={14} />}>
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "getSecretValue"}</span>
        {cfg.secretId && <span className="text-slate-500"> · {cfg.secretId}</span>}
      </div>
    </NodeWrapper>
  );
}
