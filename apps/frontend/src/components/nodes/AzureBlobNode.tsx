import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { AzureBlobConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

/**
 * Azure Blob Storage node — object-store for Azure, S3-equivalent.
 *
 * Reuses the generic NodeWrapper (same as the AWS nodes). The registry
 * entry supplies the Azure colour + icon name; content here is a compact
 * preview of the operation + container/blob identity so users can read
 * the workflow at a glance without opening the Properties panel.
 */
export function AzureBlobNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as AzureBlobConfig;
  return (
    <NodeWrapper
      nodeId={id}
      kind={data.kind}
      label={data.label}
      selected={selected}
      style={data.style}
    >
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "uploadBlob"}</span>
        {cfg.container && (
          <span className="text-slate-500"> · {cfg.container}</span>
        )}
        {cfg.blob && (
          <span className="text-slate-500">/{cfg.blob}</span>
        )}
      </div>
    </NodeWrapper>
  );
}
