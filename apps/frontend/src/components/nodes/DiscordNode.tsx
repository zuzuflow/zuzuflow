import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { DiscordConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

/**
 * Discord node — send messages via webhook or bot, add reactions.
 */
export function DiscordNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as DiscordConfig;
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
          {cfg.operation ?? "sendWebhookMessage"}
        </span>
        {cfg.channelId && (
          <span className="text-slate-500"> · #{cfg.channelId}</span>
        )}
      </div>
    </NodeWrapper>
  );
}
