import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { AwsSsmConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";
import { AwsSsmIcon } from "../icons/AwsIcons";

export function AwsSsmNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as AwsSsmConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style} iconNode={<AwsSsmIcon size={14} />}>
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "getParameter"}</span>
        {cfg.name && <span className="text-slate-500"> · {cfg.name}</span>}
      </div>
    </NodeWrapper>
  );
}
