import type { WorkflowNode } from "@workflow/shared";

/**
 * Custom props type for workflow node components.
 * xyflow v12's NodeProps<T> requires T extends Node<Record<string, unknown>>,
 * but our WorkflowNode is the data payload, not a full Node.
 * This interface provides the same props our components actually use,
 * with properly typed data, bypassing the generic constraint issue.
 */
export interface WorkflowNodeProps {
  id: string;
  data: WorkflowNode;
  selected?: boolean;
}
