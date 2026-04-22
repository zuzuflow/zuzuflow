import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { BoxConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function BoxNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as BoxConfig;
  return (
    <NodeWrapper
      nodeId={id}
      kind={data.kind}
      label={data.label}
      selected={selected}
      style={data.style}
    >
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">
          {cfg.operation ?? "files.upload"}
        </span>
        {cfg.fileId && <span className="text-slate-500"> · {cfg.fileId}</span>}
        {!cfg.fileId && cfg.folderId && (
          <span className="text-slate-500"> · folder {cfg.folderId}</span>
        )}
      </div>
    </NodeWrapper>
  );
}
