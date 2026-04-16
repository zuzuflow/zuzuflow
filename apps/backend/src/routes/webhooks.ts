import { Router, Request, Response } from "express";
import { webhookService } from "../services/WebhookService";
import { logger } from "../logger";
import type { WebhookAuth } from "@workflow/shared";

// =============================================================================
// Webhook routes
// =============================================================================

export const webhookRouter: import("express").Router = Router();

function errorToStatus(err: unknown): number {
  if (err instanceof Error) {
    const code = (err as any).code as string | undefined;
    if (code === "NOT_FOUND") return 404;
    if (code === "CONFLICT") return 409;
    if (code === "UNAUTHORIZED") return 401;
    if (code === "METHOD_NOT_ALLOWED") return 405;
    if (code === "ENDPOINT_INACTIVE") return 403;
    if (code === "WORKFLOW_INACTIVE") return 409;
  }
  return 500;
}

// ---------------------------------------------------------------------------
// POST /webhooks/register — create a new webhook endpoint
// ---------------------------------------------------------------------------
webhookRouter.post("/register", async (req: Request, res: Response) => {
  try {
    const { workflowId, path, method, auth } = req.body as {
      workflowId: string;
      path: string;
      method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      auth?: WebhookAuth;
    };

    if (!workflowId || !path) {
      return res.status(400).json({ error: "workflowId and path are required" });
    }

    const environmentId = (req as any).environmentId as string;
    const endpoint = await webhookService.registerEndpoint({
      workflowId,
      path,
      method,
      auth,
      environmentId,
    });

    res.status(201).json(endpoint);
  } catch (err) {
    logger.error("POST /webhooks/register error", { err });
    res.status(errorToStatus(err)).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /webhooks/:id — delete a webhook endpoint registration
// ---------------------------------------------------------------------------
webhookRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    await webhookService.deleteEndpoint(req.params.id);
    res.status(204).send();
  } catch (err) {
    logger.error("DELETE /webhooks/:id error", { err, id: req.params.id });
    res.status(errorToStatus(err)).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// ALL /webhooks/inbound/:path(*) — inbound webhook handler
// Supports any HTTP method; the method check is done inside handleInbound.
// ---------------------------------------------------------------------------
webhookRouter.all("/inbound/*", async (req: Request, res: Response) => {
  // Extract the dynamic path segment after /inbound/
  // e.g. /webhooks/inbound/my-service/orders => "my-service/orders"
  const inboundPath = req.params[0] || "";

  try {
    // Collect headers as a plain object
    const headers: Record<string, string | string[] | undefined> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      headers[key] = value;
    }

    const execution = await webhookService.handleInbound({
      path: inboundPath,
      method: req.method,
      headers,
      body: req.body,
      query: req.query as Record<string, unknown>,
    });

    res.status(200).json({
      received: true,
      executionId: execution.id,
    });
  } catch (err) {
    const status = errorToStatus(err);
    logger.warn("Inbound webhook handling failed", {
      path: inboundPath,
      method: req.method,
      err,
    });
    res.status(status).json({ error: (err as Error).message });
  }
});
