import { ApplicationFailure } from "@temporalio/activity";
import axios from "axios";

// =============================================================================
// persistenceActivities — thin HTTP client that calls the backend API to
// record execution progress, node logs, and final status.
//
// This keeps all DB writes out of the workflow function (required for
// Temporal determinism), while also keeping the worker package free of Prisma.
// =============================================================================

const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ?? "http://localhost:3001";

export interface NodeLogInput {
  executionId: string;
  nodeId: string;
  nodeKind: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
}

export interface UpdateExecutionStatusInput {
  executionId: string;
  status: "running" | "completed" | "failed" | "cancelled" | "timed_out";
  output?: Record<string, unknown>;
  error?: string;
}

/**
 * Fetch all environment variables (decrypted) as a flat key-value map.
 * Injected into the workflow context as `$env` so templates can use
 * {{$env.MY_KEY}} syntax in any node config string.
 */
export async function resolveVariablesActivity(environmentId?: string): Promise<Record<string, string>> {
  try {
    const query = environmentId ? `?environmentId=${encodeURIComponent(environmentId)}` : "";
    const res = await axios.get(`${BACKEND_URL}/internal/variables/resolve${query}`);
    return res.data as Record<string, string>;
  } catch (err) {
    // Non-fatal — return empty map if variables endpoint is unavailable
    return {};
  }
}

/**
 * Resolve (decrypt) a stored credential by ID.
 * Returns the plain key-value map so activities can use it directly.
 */
export async function resolveCredentialActivity(
  credentialId: string
): Promise<Record<string, string>> {
  try {
    const res = await axios.post(
      `${BACKEND_URL}/internal/credentials/${credentialId}/resolve`
    );
    return res.data as Record<string, string>;
  } catch (err) {
    throw ApplicationFailure.create({
      message: `Failed to resolve credential ${credentialId}: ${(err as Error).message}`,
      type: "CREDENTIAL_ERROR",
      nonRetryable: true,
    });
  }
}

/**
 * Create a fresh Execution record in the backend DB.
 * Used when GraphInterpreter is triggered by a Temporal Schedule (executionId="auto").
 * Returns the newly created execution's ID.
 */
export async function createExecutionRecordActivity(input: {
  workflowId: string;
  triggerPayload: Record<string, unknown>;
  environmentId?: string;
}): Promise<string> {
  try {
    const res = await axios.post(`${BACKEND_URL}/internal/executions`, {
      workflowId: input.workflowId,
      triggerPayload: input.triggerPayload,
      environmentId: input.environmentId,
    });
    return (res.data as { id: string }).id;
  } catch (err) {
    throw ApplicationFailure.create({
      message: `Failed to create execution record: ${(err as Error).message}`,
      type: "PERSISTENCE_ERROR",
      nonRetryable: false,
    });
  }
}

/**
 * Write a per-node log entry to the backend.
 */
export async function writeNodeLogActivity(input: NodeLogInput): Promise<void> {
  try {
    await axios.post(
      `${BACKEND_URL}/internal/executions/${input.executionId}/logs`,
      {
        nodeId: input.nodeId,
        nodeKind: input.nodeKind,
        level: input.level,
        message: input.message,
        data: input.data,
      }
    );
  } catch (err) {
    throw ApplicationFailure.create({
      message: `Failed to write node log: ${(err as Error).message}`,
      type: "PERSISTENCE_ERROR",
      nonRetryable: false,
    });
  }
}

/**
 * Update the Execution record status in the backend database.
 */
export async function updateExecutionStatusActivity(
  input: UpdateExecutionStatusInput
): Promise<void> {
  try {
    await axios.patch(
      `${BACKEND_URL}/internal/executions/${input.executionId}/status`,
      {
        status: input.status,
        output: input.output,
        error: input.error,
      }
    );
  } catch (err) {
    throw ApplicationFailure.create({
      message: `Failed to update execution status: ${(err as Error).message}`,
      type: "PERSISTENCE_ERROR",
      nonRetryable: false,
    });
  }
}
