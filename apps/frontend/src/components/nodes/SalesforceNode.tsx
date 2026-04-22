import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { SalesforceConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

/**
 * Salesforce node — SOQL queries, sObject CRUD, Apex REST.
 */
export function SalesforceNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as SalesforceConfig;
  return (
    <NodeWrapper
      nodeId={id}
      kind={data.kind}
      label={data.label}
      selected={selected}
      style={data.style}
    >
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "query"}</span>
        {cfg.sobject && (
          <span className="text-slate-500"> · {cfg.sobject}</span>
        )}
        {cfg.recordId && (
          <span className="text-slate-500"> · {cfg.recordId}</span>
        )}
      </div>
    </NodeWrapper>
  );
}
