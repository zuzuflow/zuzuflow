import { Router, Request, Response } from "express";
import { executionService } from "../services/ExecutionService";
import { dashboardStatsService, type DashboardWindow } from "../services/DashboardStatsService";
import { prisma } from "../db/client";
import { logger } from "../logger";

// =============================================================================
// Execution routes
// =============================================================================

export const executionRouter: import("express").Router = Router();

function errorToStatus(err: unknown): number {
  if (err instanceof Error) {
    const code = (err as any).code as string | undefined;
    if (code === "NOT_FOUND") return 404;
    if (code === "VALIDATION_ERROR") return 422;
    if (code === "WORKFLOW_INACTIVE") return 409;
    if (code === "INVALID_STATE") return 409;
    if (code === "ALREADY_STARTED") return 409;
  }
  return 500;
}

// ---------------------------------------------------------------------------
// GET /executions/stats — env-scoped aggregate for the Dashboard.
//
// Query: ?window=1h|24h|7d|30d   (default: 24h)
// Returns the whole dashboard payload in one round trip — KPIs, timeline,
// top workflows, recent failures, recent executions. Safe to poll every 15s.
// ---------------------------------------------------------------------------
const VALID_WINDOWS = new Set<DashboardWindow>(["1h", "24h", "7d", "30d"]);

executionRouter.get("/stats", async (req: Request, res: Response) => {
  try {
    const environmentId = (req as any).environmentId as string;
    if (!environmentId) {
      return res.status(400).json({ error: "Missing environment context" });
    }

    const rawWindow = (req.query.window as string) || "24h";
    const window = VALID_WINDOWS.has(rawWindow as DashboardWindow)
      ? (rawWindow as DashboardWindow)
      : "24h";

    const stats = await dashboardStatsService.getStats(environmentId, window);
    // Cache-Control: short-lived — dashboard polls every 15s, caching 10s
    // protects against hot-reload bursts without making data noticeably stale.
    res.setHeader("Cache-Control", "private, max-age=10");
    res.json(stats);
  } catch (err) {
    logger.error("GET /executions/stats", { err });
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// POST /executions/start — manually trigger a workflow
// ---------------------------------------------------------------------------
executionRouter.post("/start", async (req: Request, res: Response) => {
  try {
    const { workflowId, triggerPayload } = req.body as {
      workflowId: string;
      triggerPayload?: Record<string, unknown>;
    };

    if (!workflowId || typeof workflowId !== "string") {
      return res.status(400).json({ error: "workflowId is required" });
    }

    const environmentId = (req as any).environmentId as string;
    const execution = await executionService.startExecution({
      workflowId,
      triggerPayload,
      environmentId,
    });

    res.status(201).json(execution);
  } catch (err) {
    logger.error("POST /executions/start error", { err });
    res.status(errorToStatus(err)).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// POST /executions/trigger/:ref — fire an external_trigger workflow
// `:ref` is either the stable `key` (e.g. "wf_a7b3k2m9pq") or the raw DB `id`
// (UUID). Keys are preferred because they survive export/import; ids are
// accepted for backwards compatibility with pre-key SDK snippets.
// Authenticated via existing requireAuth middleware (Bearer / wf_* API token).
// The workflow MUST have an external_trigger node or the call is rejected.
// ---------------------------------------------------------------------------
executionRouter.post("/trigger/:ref", async (req: Request, res: Response) => {
  try {
    const { ref } = req.params;
    const { payload } = req.body as { payload?: Record<string, unknown> };

    const environmentId = (req as any).environmentId as string;
    // Resolve by stable key first (modern path), then fall back to id (legacy)
    const workflow = await prisma.workflow.findFirst({
      where: { environmentId, OR: [{ key: ref }, { id: ref }] },
    });
    if (!workflow) {
      return res.status(404).json({ error: `Workflow ${ref} not found` });
    }
    const workflowId = workflow.id;

    const template = workflow.template as any;
    const triggerNodes = Array.isArray(template?.nodes)
      ? template.nodes.filter((n: any) => n.kind === "external_trigger")
      : [];

    if (triggerNodes.length === 0) {
      return res.status(422).json({
        error: "Workflow does not have an External Trigger node. Add one before calling this endpoint.",
      });
    }
    if (triggerNodes.length > 1) {
      return res.status(422).json({
        error: "Workflow has multiple External Trigger nodes; exactly one is required so the trigger call is unambiguous.",
      });
    }

    const triggerPayload: Record<string, unknown> = {
      _source: "external_trigger",
      triggeredAt: new Date().toISOString(),
      ...(payload ?? {}),
    };

    const execution = await executionService.startExecution({ workflowId, triggerPayload, environmentId });
    res.status(201).json(execution);
  } catch (err) {
    logger.error("POST /executions/trigger error", { err });
    res.status(errorToStatus(err)).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// GET /executions — list executions (optionally filter by workflowId / status)
// ---------------------------------------------------------------------------
executionRouter.get("/", async (req: Request, res: Response) => {
  try {
    const workflowId = req.query.workflowId as string | undefined;
    const status = req.query.status as string | undefined;
    const q = req.query.q as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const environmentId = (req as any).environmentId as string;
    const result = await executionService.listExecutions({
      environmentId,
      workflowId,
      status,
      q,
      from,
      to,
      limit,
      offset,
    });

    res.json(result);
  } catch (err) {
    logger.error("GET /executions error", { err });
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// GET /executions/logs/search — Grafana-style cross-execution log-line search
// Query params: q, level, workflowId, nodeKind, from, to, limit, offset
// MUST be registered before /:id routes so "logs" isn't captured as an id.
// ---------------------------------------------------------------------------
executionRouter.get("/logs/search", async (req: Request, res: Response) => {
  try {
    const environmentId = (req as any).environmentId as string;
    const result = await executionService.searchLogs({
      environmentId,
      q: req.query.q as string | undefined,
      level: req.query.level as string | undefined,
      workflowId: req.query.workflowId as string | undefined,
      nodeKind: req.query.nodeKind as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    });
    res.json(result);
  } catch (err) {
    logger.error("GET /executions/logs/search error", { err });
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// GET /executions/:id — get a single execution with its logs
// ---------------------------------------------------------------------------
executionRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const execution = await executionService.getExecution(req.params.id);
    res.json(execution);
  } catch (err) {
    logger.error("GET /executions/:id error", { err, id: req.params.id });
    res.status(errorToStatus(err)).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// GET /executions/:id/logs — filtered, searchable execution logs
// Query params: nodeId, nodeKind, level, search, limit, offset
// ---------------------------------------------------------------------------
executionRouter.get("/:id/logs", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const nodeId = req.query.nodeId as string | undefined;
    const nodeKind = req.query.nodeKind as string | undefined;
    const level = req.query.level as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 200;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const result = await executionService.getExecutionLogs(id, {
      nodeId,
      nodeKind,
      level,
      search,
      limit,
      offset,
    });

    res.json(result);
  } catch (err) {
    logger.error("GET /executions/:id/logs error", { err, id: req.params.id });
    res.status(errorToStatus(err)).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /executions/:id — cancel a running execution
// ---------------------------------------------------------------------------
executionRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const execution = await executionService.cancelExecution(req.params.id);
    // null means the record was deleted (was already in a terminal state)
    if (execution === null) {
      res.status(204).end();
    } else {
      res.json(execution);
    }
  } catch (err) {
    logger.error("DELETE /executions/:id error", { err, id: req.params.id });
    res.status(errorToStatus(err)).json({ error: (err as Error).message });
  }
});
