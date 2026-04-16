import { ApplicationFailure } from "@temporalio/activity";
import axios from "axios";

// =============================================================================
// prepareSubworkflowActivity
//
// Called by the subworkflow_call node handler in GraphInterpreter.
// Validates that the target workflow exists, is active, and is a subworkflow,
// then creates an execution record and returns what the interpreter needs to
// launch the child Temporal workflow via executeChild().
// =============================================================================

const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ?? "http://localhost:3001";

export interface PrepareSubworkflowInput {
  subworkflowId: string;
  triggerPayload: Record<string, unknown>;
}

export interface PrepareSubworkflowOutput {
  executionId: string;
  template: unknown;
  triggerPayload: Record<string, unknown>;
}

export async function prepareSubworkflowActivity(
  input: PrepareSubworkflowInput
): Promise<PrepareSubworkflowOutput> {
  const { subworkflowId, triggerPayload } = input;

  if (!subworkflowId) {
    throw ApplicationFailure.create({
      message: "subworkflow_call: no subworkflowId configured",
      type: "MISSING_CONFIG",
      nonRetryable: true,
    });
  }

  try {
    const res = await axios.post<PrepareSubworkflowOutput>(
      `${BACKEND_URL}/internal/executions/prepare`,
      { workflowId: subworkflowId, triggerPayload, requireSubworkflow: true }
    );
    return res.data;
  } catch (err: any) {
    const status = err?.response?.status;
    const message = err?.response?.data?.error ?? err?.message ?? String(err);

    throw ApplicationFailure.create({
      message: `Failed to prepare subworkflow "${subworkflowId}": ${message}`,
      type:
        status === 422
          ? "WORKFLOW_INACTIVE"
          : status === 404
          ? "WORKFLOW_NOT_FOUND"
          : "PREPARE_ERROR",
      nonRetryable: status === 404 || status === 422,
    });
  }
}
