import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { AwsDynamoDBConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";
import { AwsDynamoDBIcon } from "../icons/AwsIcons";

export function AwsDynamoDBNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as AwsDynamoDBConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style} iconNode={<AwsDynamoDBIcon size={14} />}>
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "getItem"}</span>
        {cfg.tableName && <span className="text-slate-500"> · {cfg.tableName}</span>}
      </div>
    </NodeWrapper>
  );
}
