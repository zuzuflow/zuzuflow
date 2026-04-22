import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { GoogleDriveConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function GoogleDriveNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as GoogleDriveConfig;
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
        {cfg.fileId && <span className="text-slate-500"> · {cfg.fileId}</span>}
        {cfg.name && !cfg.fileId && (
          <span className="text-slate-500"> · {cfg.name}</span>
        )}
      </div>
    </NodeWrapper>
  );
}
