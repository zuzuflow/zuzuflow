import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import { NodeWrapper } from "../canvas/NodeWrapper";
import { useWorkflowStore } from "../../store/workflowStore";
import { useEnvironmentStore } from "../../store/environmentStore";

function NodeJsIcon({ size = 13 }: { size?: number }): React.ReactElement {
  // Simplified Node.js hexagon logo — two nested hexagons + inner highlight
  return (
    <svg width={size} height={size} viewBox="0 0 100 115" fill="none" className="shrink-0 opacity-90" aria-label="Node.js">
      {/* Outer hexagon */}
      <path
        d="M50 2 L96 27.5 L96 87.5 L50 113 L4 87.5 L4 27.5 Z"
        fill="rgba(255,255,255,0.18)"
        stroke="white"
        strokeWidth="6"
      />
      {/* Inner ">" chevron — evokes a terminal / JS runtime */}
      <polyline
        points="28,42 50,57.5 28,73"
        stroke="white"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <line x1="56" y1="73" x2="72" y2="73" stroke="white" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

export function ExternalTriggerNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const workflowKey = useWorkflowStore((s) => s.workflowKey);
  const envSlug = useEnvironmentStore((s) => s.currentSlug);

  const keyLabel = workflowKey ?? "wf_xxxxxxxxxx";
  const envLabel = envSlug ?? "production";

  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style} iconNode={<NodeJsIcon size={14} />}>
      <div className="space-y-1.5">
        <p className="text-slate-500 text-[10px]">Trigger via npm package:</p>
        <code className="block bg-slate-900 rounded px-2 py-1 text-[10px] font-mono text-indigo-300 leading-relaxed whitespace-pre-wrap break-all">
          {"client.executions.trigger({\n  id: "}
          <span className="text-amber-300">"{keyLabel}"</span>
          {",\n  environment: "}
          <span className="text-amber-300">"{envLabel}"</span>
          {"\n})"}
        </code>
        <p className="text-[10px] text-slate-600">
          Install: <span className="text-slate-500 font-mono">@zuzuflow/nodejs-sdk</span>
        </p>
        <p className="text-[10px] text-slate-600">
          The <span className="text-slate-400 font-mono">id</span> above is the workflow's stable key —
          it survives export/import between environments.
        </p>
        <p className="text-[10px] text-slate-600">
          Add a <span className="text-slate-400">Trigger Response</span> node to return data
        </p>
      </div>
    </NodeWrapper>
  );
}
