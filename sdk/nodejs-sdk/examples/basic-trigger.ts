/**
 * Basic Trigger Example
 *
 * Demonstrates how to trigger a ZuzuFlow workflow from a Node.js application
 * using @zuzuflow/nodejs-sdk.
 *
 * Setup:
 *   1. Go to ZuzuFlow → Settings → API Tokens → Generate Token
 *   2. Copy the token (starts with "wf_")
 *   3. In your workflow, add an "External Trigger" node as the entry point
 *   4. Add a "Trigger Response" node at the end to define what data to return
 *   5. Copy the workflow ID from the trigger node
 *
 * Run:
 *   npx ts-node examples/basic-trigger.ts
 */

import { ZuzuFlowClient } from "@zuzuflow/nodejs-sdk";

const client = new ZuzuFlowClient({
  baseUrl: "https://app.zuzuflow.com",
  envSlug: "production",
  token: "wf_your_api_token_here",
});

// ── 1. Fire and Forget ──────────────────────────────────────────────────────
// Trigger the workflow and get back the execution ID immediately.
// The workflow runs in the background.

async function fireAndForget() {
  const { executionId, status } = await client.executions.trigger("your-workflow-id", {
    userId: "user-123",
    action: "process_order",
    data: { orderId: "ORD-456", amount: 99.99 },
  });

  console.log(`Triggered! Execution: ${executionId}, Status: ${status}`);

  // Later, check the status manually
  const result = await client.executions.get(executionId);
  console.log(`Execution status: ${result.status}`);
  if (result.output) console.log("Output:", result.output);
}

// ── 2. Trigger and Wait ──────────────────────────────────────────────────────
// Trigger and block until the workflow completes. Good for synchronous flows.

async function triggerAndWait() {
  try {
    const result = await client.executions.triggerAndWait(
      "your-workflow-id",
      { userId: "user-123", email: "user@example.com" },
      { timeoutMs: 60_000 } // wait up to 60 seconds
    );

    console.log("Workflow completed!");
    console.log("Output:", result.output);
    console.log(`Duration: ${result.startedAt} → ${result.completedAt}`);
  } catch (err) {
    if (err instanceof Error && err.name === "TriggerTimeoutError") {
      console.error("Workflow took too long!");
    } else if (err instanceof Error && err.name === "WorkflowExecutionError") {
      console.error("Workflow failed:", err.message);
    } else {
      throw err;
    }
  }
}

// ── 3. Stream Events Live ────────────────────────────────────────────────────
// Trigger and receive real-time events as each node executes.
// Great for progress tracking and live dashboards.

async function streamEvents() {
  for await (const event of client.executions.triggerAndStream("your-workflow-id", {
    userId: "user-123",
  })) {
    switch (event.kind) {
      case "execution_started":
        console.log("Workflow started");
        break;
      case "node_started":
        console.log(`  → Node "${event.nodeId}" (${event.nodeKind}) started`);
        break;
      case "node_completed":
        console.log(`  ✓ Node "${event.nodeId}" (${event.nodeKind}) completed`, event.payload);
        break;
      case "node_failed":
        console.log(`  ✗ Node "${event.nodeId}" (${event.nodeKind}) failed`, event.payload);
        break;
      case "execution_completed":
        console.log("Workflow completed!", event.payload);
        break;
      case "execution_failed":
        console.log("Workflow failed!", event.payload);
        break;
    }
  }
}

// ── 4. List Workflows With Tag Filter ────────────────────────────────────────

async function listWorkflows() {
  const page = await client.workflows.list({ tagsAny: ["production"] });
  console.log(`Found ${page.total} workflow(s) tagged 'production':`);
  for (const wf of page.items) {
    console.log(`  - ${wf.name} (${wf.id}) [${wf.status}]`);
  }
}

// ── Run one of the examples ──────────────────────────────────────────────────
// Uncomment the one you want to try:

// fireAndForget().catch(console.error);
// triggerAndWait().catch(console.error);
// streamEvents().catch(console.error);
// listWorkflows().catch(console.error);
