import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { OneDriveConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function OneDriveNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as OneDriveConfig;
  return (
    <NodeWrapper
      nodeId={id}
      kind={data.kind}
      label={data.label}
      selected={selected}
      style={data.style}
    >
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "files.list"}</span>
        {cfg.path && <span className="text-slate-500"> · {cfg.path}</span>}
        {!cfg.path && cfg.itemId && (
          <span className="text-slate-500"> · {cfg.itemId}</span>
        )}
      </div>
    </NodeWrapper>
  );
}
