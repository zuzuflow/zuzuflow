import { ApplicationFailure } from "@temporalio/activity";
import axios from "axios";
import type { WorkflowTriggerOutConfig } from "@workflow/shared";
import { interpolateTemplate } from "@workflow/shared";

// =============================================================================
// triggerWorkflowActivity — starts another workflow by ID (Workflow Trigger Out)
//
// Calls the backend's internal /executions/trigger endpoint so that the
// backend's ExecutionService (which holds the Temporal client) handles
// launching the child Temporal workflow. The worker package has no Temporal
// client of its own.
// =============================================================================

const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ?? "http://localhost:3001";

export interface TriggerWorkflowActivityInput {
  config: WorkflowTriggerOutConfig;
  context: Record<string, unknown>;
  sourceWorkflowId: string;
  sourceExecutionId: string;
}

export interface TriggerWorkflowActivityOutput {
  targetWorkflowId: string;
  executionId: string;
  started: boolean;
}

export async function triggerWorkflowActivity(
  input: TriggerWorkflowActivityInput
): Promise<TriggerWorkflowActivityOutput> {
  const { config: cfg, context, sourceWorkflowId, sourceExecutionId } = input;

  const targetWorkflowId = interpolateTemplate(cfg.targetWorkflowId, context);

  if (!targetWorkflowId) {
    throw ApplicationFailure.create({
      message: "workflow_trigger_out: no targetWorkflowId configured",
      type: "MISSING_CONFIG",
      nonRetryable: true,
    });
  }

  // Parse the payload expression (supports JSON or template string)
  let triggerPayload: Record<string, unknown> = {
    _source: "workflow_trigger_out",
    _sourceWorkflowId: sourceWorkflowId,
    _sourceExecutionId: sourceExecutionId,
  };

  if (cfg.payload) {
    const interpolated = interpolateTemplate(cfg.payload, context);
    try {
      const parsed = JSON.parse(interpolated);
      if (typeof parsed === "object" && parsed !== null) {
        triggerPayload = { ...triggerPayload, ...(parsed as Record<string, unknown>) };
      }
    } catch {
      triggerPayload = { ...triggerPayload, value: interpolated };
    }
  }

  // Delegate to the backend — it owns the Temporal client and ExecutionService
  try {
    const res = await axios.post<{ executionId: string }>(
      `${BACKEND_URL}/internal/executions/trigger`,
      { workflowId: targetWorkflowId, triggerPayload }
    );

    return {
      targetWorkflowId,
      executionId: res.data.executionId,
      started: true,
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const message = err?.response?.data?.error ?? err?.message ?? String(err);

    throw ApplicationFailure.create({
      message: `Failed to trigger workflow "${targetWorkflowId}": ${message}`,
      type: status === 422 ? "WORKFLOW_INACTIVE" : status === 404 ? "WORKFLOW_NOT_FOUND" : "TRIGGER_ERROR",
      nonRetryable: status === 404 || status === 422,
    });
  }
}
