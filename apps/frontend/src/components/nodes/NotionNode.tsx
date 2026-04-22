import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { NotionConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

/**
 * Notion node — pages, blocks, databases, search.
 */
export function NotionNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as NotionConfig;
  const target = cfg.databaseId
    ? `db:${cfg.databaseId.slice(0, 8)}…`
    : cfg.pageId
      ? `page:${cfg.pageId.slice(0, 8)}…`
      : undefined;
  return (
    <NodeWrapper
      nodeId={id}
      kind={data.kind}
      label={data.label}
      selected={selected}
      style={data.style}
    >
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "pages.create"}</span>
        {target && <span className="text-slate-500"> · {target}</span>}
      </div>
    </NodeWrapper>
  );
}
