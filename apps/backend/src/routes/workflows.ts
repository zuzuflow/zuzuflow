import { Router, Request, Response } from "express";
import { workflowService } from "../services/WorkflowService";
import { prisma } from "../db/client";
import { logger } from "../logger";

// =============================================================================
// Workflow routes
// =============================================================================

export const workflowRouter: import("express").Router = Router();

// Helper to extract a structured error code → HTTP status
function errorToStatus(err: unknown): number {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException & { code?: string }).code;
    if (code === "NOT_FOUND") return 404;
    if (code === "VALIDATION_ERROR") return 422;
    if (code === "CONFLICT") return 409;
  }
  return 500;
}

// ---------------------------------------------------------------------------
// GET /workflows — list all workflows
// Query params:
//   status, folderId, limit, offset  — standard filters
//   hasTrigger=workflow_trigger_in   — return only workflows containing this node kind
//   isSubworkflow=true               — return only subworkflows
// ---------------------------------------------------------------------------
workflowRouter.get("/", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const status = req.query.status as string | undefined;
    const folderId = req.query.folderId as string | undefined;
    const hasTrigger = req.query.hasTrigger as string | undefined;
    const isSubworkflowParam = req.query.isSubworkflow as string | undefined;
    const tagsAny = (req.query.tags as string | undefined)
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const tagsAll = (req.query.tagsAll as string | undefined)
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const environmentId = (req as any).environmentId as string;

    // Return only subworkflows when ?isSubworkflow=true
    if (isSubworkflowParam === "true") {
      const subworkflows = await prisma.workflow.findMany({
        where: { isSubworkflow: true, environmentId },
        select: { id: true, key: true, name: true, description: true, status: true, isSubworkflow: true, folderId: true, createdAt: true, updatedAt: true },
        orderBy: { name: "asc" },
      });
      return res.json({ total: subworkflows.length, items: subworkflows, limit, offset });
    }

    const result = await workflowService.listWorkflows({ environmentId, status, folderId, tagsAny, tagsAll, limit, offset });

    // Filter by node kind — fetch all active workflows and filter in JS to avoid json/jsonb cast issues
    if (hasTrigger) {
      const allActive = await prisma.workflow.findMany({
        where: { status: "active", environmentId },
        select: { id: true, name: true, template: true },
        orderBy: { name: "asc" },
      });
      const matching = allActive.filter((wf) => {
        const tmpl = wf.template as any;
        return Array.isArray(tmpl?.nodes) && tmpl.nodes.some((n: any) => n.kind === hasTrigger);
      });
      return res.json({
        total: matching.length,
        items: matching.map(({ id, name }) => ({ id, name })),
        limit,
        offset,
      });
    }

    res.json(result);
  } catch (err) {
    logger.error("GET /workflows error", { err });
    res.status(errorToStatus(err)).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// POST /workflows — create a new workflow
// ---------------------------------------------------------------------------
workflowRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { name, description, template, folderId, isSubworkflow, tags, key } = req.body as {
      name: string;
      description?: string;
      template: unknown;
      folderId?: string;
      isSubworkflow?: boolean;
      tags?: string[];
      key?: string;
    };

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "name is required" });
    }
    if (!template) {
      return res.status(400).json({ error: "template is required" });
    }

    const environmentId = (req as any).environmentId as string;
    const workflow = await workflowService.createWorkflow({
      name,
      description,
      template: template as any,
      folderId,
      isSubworkflow: !!isSubworkflow,
      environmentId,
      tags,
      key,
    });

    res.status(201).json(workflow);
  } catch (err) {
    logger.error("POST /workflows error", { err });
    res.status(errorToStatus(err)).json({
      error: (err as Error).message,
      details: (err as any).details,
    });
  }
});

// ---------------------------------------------------------------------------
// GET /workflows/:id — get a single workflow
// ---------------------------------------------------------------------------
workflowRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const workflow = await workflowService.getWorkflow(req.params.id);
    res.json(workflow);
  } catch (err) {
    logger.error("GET /workflows/:id error", { err, id: req.params.id });
    res.status(errorToStatus(err)).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// PUT /workflows/:id — update a workflow
// ---------------------------------------------------------------------------
workflowRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const { name, description, template, folderId, tags, key } = req.body as {
      name?: string;
      description?: string;
      template?: unknown;
      folderId?: string | null;
      tags?: string[];
      key?: string;
    };

    const workflow = await workflowService.updateWorkflow(req.params.id, {
      name,
      description,
      template: template as any,
      folderId,
      tags,
      key,
    });

    res.json(workflow);
  } catch (err) {
    logger.error("PUT /workflows/:id error", { err, id: req.params.id });
    res.status(errorToStatus(err)).json({
      error: (err as Error).message,
      details: (err as any).details,
    });
  }
});

// ---------------------------------------------------------------------------
// DELETE /workflows/:id — delete a workflow
// ---------------------------------------------------------------------------
workflowRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    await workflowService.deleteWorkflow(req.params.id);
    res.status(204).send();
  } catch (err) {
    logger.error("DELETE /workflows/:id error", { err, id: req.params.id });
    res.status(errorToStatus(err)).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// POST /workflows/:id/activate — set status to active
// ---------------------------------------------------------------------------
workflowRouter.post("/:id/activate", async (req: Request, res: Response) => {
  try {
    const workflow = await workflowService.activateWorkflow(req.params.id);
    res.json(workflow);
  } catch (err) {
    logger.error("POST /workflows/:id/activate error", { err, id: req.params.id });
    res.status(errorToStatus(err)).json({
      error: (err as Error).message,
      details: (err as any).details,
    });
  }
});

// ---------------------------------------------------------------------------
// POST /workflows/:id/deactivate — set status to inactive
// ---------------------------------------------------------------------------
workflowRouter.post("/:id/deactivate", async (req: Request, res: Response) => {
  try {
    const workflow = await workflowService.deactivateWorkflow(req.params.id);
    res.json(workflow);
  } catch (err) {
    logger.error("POST /workflows/:id/deactivate error", { err, id: req.params.id });
    res.status(errorToStatus(err)).json({ error: (err as Error).message });
  }
});
