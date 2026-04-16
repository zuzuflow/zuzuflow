import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { S3BucketConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";
import { AwsS3Icon } from "../icons/AwsIcons";

export function S3BucketNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as S3BucketConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style} iconNode={<AwsS3Icon size={14} />}>
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "getObject"}</span>
        {cfg.bucket && <span className="text-slate-500"> · {cfg.bucket}</span>}
      </div>
    </NodeWrapper>
  );
}
