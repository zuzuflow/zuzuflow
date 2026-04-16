/**
 * Express Webhook Example
 *
 * Shows how to use @zuzuflow/nodejs-sdk in an Express.js app
 * to trigger workflows from incoming HTTP requests.
 *
 * Use case: Your app receives a webhook (e.g., Stripe payment, GitHub push)
 * and triggers a ZuzuFlow workflow to process it.
 *
 * Run:
 *   npx ts-node examples/express-webhook.ts
 */

import express from "express";
import { ZuzuFlowClient } from "@zuzuflow/nodejs-sdk";

const app = express();
app.use(express.json());

const client = new ZuzuFlowClient({
  baseUrl: process.env.ZUZUFLOW_BASE_URL || "https://app.zuzuflow.com",
  envSlug: process.env.ZUZUFLOW_ENV || "production",
  token: process.env.ZUZUFLOW_API_TOKEN || "wf_your_token",
});

// ── Endpoint: Trigger a workflow when a new order comes in ──────────────────

app.post("/webhooks/new-order", async (req, res) => {
  try {
    const { orderId, customerId, items, total } = req.body;

    // Fire and forget — respond immediately, workflow runs in background
    const { executionId } = await client.executions.trigger("order-processing-workflow-id", {
      orderId,
      customerId,
      items,
      total,
      source: "webhook",
    });

    res.json({
      success: true,
      message: "Order processing started",
      executionId,
    });
  } catch (err) {
    console.error("Failed to trigger workflow:", err);
    res.status(500).json({ error: "Failed to start order processing" });
  }
});

// ── Endpoint: Trigger and wait for result ────────────────────────────────────

app.post("/api/validate-address", async (req, res) => {
  try {
    const { address } = req.body;

    // Wait for the workflow to complete — synchronous pattern
    const result = await client.executions.triggerAndWait(
      "address-validation-workflow-id",
      { address },
      { timeoutMs: 10_000 } // 10 second timeout
    );

    const output = (result.output ?? {}) as { isValid?: boolean; normalizedAddress?: unknown };
    res.json({
      valid: output.isValid,
      normalized: output.normalizedAddress,
    });
  } catch (err: any) {
    if (err.name === "TriggerTimeoutError") {
      res.status(504).json({ error: "Validation timed out" });
    } else {
      res.status(500).json({ error: "Validation failed" });
    }
  }
});

// ── Endpoint: Stream progress back via SSE ───────────────────────────────────

app.get("/api/process/:jobId/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    for await (const event of client.executions.triggerAndStream("data-processing-workflow-id", {
      jobId: req.params.jobId,
    })) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ kind: "error", message: String(err) })}\n\n`);
  }

  res.end();
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
