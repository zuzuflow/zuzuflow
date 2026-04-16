import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import { broadcast } from "../ws/executionBroadcaster";
import { logger } from "../logger";
import { credentialService } from "../services/CredentialService";
import { variableService } from "../services/VariableService";
import { executionService } from "../services/ExecutionService";
import type { ExecutionEvent } from "@workflow/shared";

// =============================================================================
// Internal routes — called by the Temporal worker's persistence activities.
// These routes are NOT exposed publicly; in production, bind them to a
// separate port or protect them with a service-to-service secret header.
// =============================================================================

export const internalRouter: import("express").Router = Router();

// ---------------------------------------------------------------------------
// POST /internal/credentials/:id/resolve — decrypt and return credential data
// Called by the Temporal worker's resolveCredentialActivity.
// Protected by the same network boundary as other /internal routes.
// ---------------------------------------------------------------------------
internalRouter.post(
  "/credentials/:id/resolve",
  async (req: Request, res: Response) => {
    try {
      const data = await credentialService.resolveCredential(req.params.id);
      res.json(data);
    } catch (err) {
      const code = (err as any).code;
      res.status(code === "NOT_FOUND" ? 404 : 500).json({ error: (err as Error).message });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /internal/variables/resolve — return all variables as plain key-value map
// Called by the Temporal worker at the start of each workflow execution.
// ---------------------------------------------------------------------------
internalRouter.get("/variables/resolve", async (req: Request, res: Response) => {
  try {
    const environmentId = (req.query.environmentId as string) || "env-default-production";
    const vars = await variableService.resolveAllVariables(environmentId);
    res.json(vars);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// POST /internal/executions/prepare — called by subworkflow_call activity.
// Validates the target workflow, creates an execution record, and returns
// the template so the worker can launch it as a Temporal child workflow.
// ---------------------------------------------------------------------------
internalRouter.post("/executions/prepare", async (req: Request, res: Response) => {
  try {
    const { workflowId, triggerPayload, requireSubworkflow, environmentId } = req.body as {
      workflowId: string;
      triggerPayload?: Record<string, unknown>;
      requireSubworkflow?: boolean;
      environmentId?: string;
    };

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } }) as any;
    if (!workflow) {
      return res.status(404).json({ error: `Workflow ${workflowId} not found` });
    }
    if (requireSubworkflow && !workflow.isSubworkflow) {
      return res.status(422).json({ error: `Workflow ${workflowId} is not marked as a subworkflow` });
    }
    if (workflow.status !== "active") {
      return res.status(422).json({ error: `Workflow ${workflowId} is not active (status: ${workflow.status})` });
    }

    const envId = environmentId || workflow.environmentId;
    const { v4: uuidv4 } = await import("uuid");
    const executionId = uuidv4();
    await prisma.execution.create({
      data: {
        id: executionId,
        workflowId,
        status: "pending",
        triggerPayload: (triggerPayload ?? {}) as Prisma.InputJsonValue,
        environmentId: envId,
      },
    });

    res.status(201).json({ executionId, template: workflow.template, triggerPayload: triggerPayload ?? {}, environmentId: envId });
  } catch (err) {
    logger.error("POST /internal/executions/prepare error", { err });
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// POST /internal/executions/trigger — start a workflow execution from a worker
// activity (e.g. workflow_trigger_out node). Delegates to ExecutionService so
// the Temporal workflow is properly launched.
// ---------------------------------------------------------------------------
internalRouter.post("/executions/trigger", async (req: Request, res: Response) => {
  try {
    const { workflowId, triggerPayload, environmentId } = req.body as {
      workflowId: string;
      triggerPayload?: Record<string, unknown>;
      environmentId?: string;
    };

    // Look up workflow's environmentId if not provided
    let envId = environmentId;
    if (!envId) {
      const wf = await prisma.workflow.findUnique({ where: { id: workflowId }, select: { environmentId: true } });
      envId = wf?.environmentId ?? "env-default-production";
    }

    const execution = await executionService.startExecution({ workflowId, triggerPayload, environmentId: envId });
    res.status(201).json({ executionId: execution.id });
  } catch (err) {
    logger.error("POST /internal/executions/trigger error", { err });
    const code = (err as any).code;
    res.status(code === "NOT_FOUND" ? 404 : code === "WORKFLOW_INACTIVE" ? 422 : 500)
      .json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// POST /internal/executions — create a new execution record (for cron runs)
// ---------------------------------------------------------------------------
internalRouter.post("/executions", async (req: Request, res: Response) => {
  try {
    const { workflowId, triggerPayload, environmentId } = req.body as {
      workflowId: string;
      triggerPayload?: Record<string, unknown>;
      environmentId?: string;
    };

    // Look up workflow's environmentId if not provided
    let envId = environmentId;
    if (!envId) {
      const wf = await prisma.workflow.findUnique({ where: { id: workflowId }, select: { environmentId: true } });
      envId = wf?.environmentId ?? "env-default-production";
    }

    const execution = await prisma.execution.create({
      data: {
        workflowId,
        status: "pending",
        triggerPayload: (triggerPayload ?? {}) as Prisma.InputJsonValue,
        environmentId: envId,
      },
    });

    res.status(201).json(execution);
  } catch (err) {
    logger.error("POST /internal/executions error", { err });
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// PATCH /internal/executions/:id/status — update execution status
// ---------------------------------------------------------------------------
internalRouter.patch(
  "/executions/:id/status",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, output, error: errorMsg } = req.body as {
        status: string;
        output?: Record<string, unknown>;
        error?: string;
      };

      const execution = await prisma.execution.update({
        where: { id },
        data: {
          status: status as any,
          ...(output !== undefined && { output: output as any }),
          ...(errorMsg !== undefined && { error: errorMsg }),
          ...((status === "completed" ||
            status === "failed" ||
            status === "cancelled" ||
            status === "timed_out") && {
            completedAt: new Date(),
          }),
        },
      });

      // Broadcast status change via WebSocket
      const event: ExecutionEvent = {
        kind:
          status === "completed"
            ? "execution_completed"
            : status === "failed"
            ? "execution_failed"
            : status === "cancelled"
            ? "execution_cancelled"
            : "execution_started",
        executionId: id,
        workflowId: execution.workflowId,
        payload: { status, output, error: errorMsg },
        timestamp: new Date().toISOString(),
      };
      broadcast(id, event);

      res.json(execution);
    } catch (err) {
      logger.error("PATCH /internal/executions/:id/status error", { err });
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /internal/executions/:id/logs — append a node log entry
// ---------------------------------------------------------------------------
internalRouter.post(
  "/executions/:id/logs",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { nodeId, nodeKind, level, message, data } = req.body as {
        nodeId: string;
        nodeKind: string;
        level: string;
        message: string;
        data?: Record<string, unknown>;
      };

      const logEntry = await prisma.executionLog.create({
        data: {
          executionId: id,
          nodeId,
          nodeKind,
          level: level as any,
          message,
          data: data as any,
        },
      });

      // Broadcast node event via WebSocket
      const execution = await prisma.execution.findUnique({
        where: { id },
        select: { workflowId: true },
      });

      if (execution) {
        // Only emit node lifecycle events for the specific system messages.
        // Console/inspect logs (data.source === "console" | "debug") are
        // broadcast as "node_log" and must NOT overwrite the node output.
        const src = (data as Record<string, unknown> | undefined)?.source as string | undefined;
        const isConsoleOrInspect = src === "console" || src === "debug";

        const msg = typeof message === "string" ? message.toLowerCase() : "";
        const kind: string | null = isConsoleOrInspect
          ? "node_log"
          : level === "error"
          ? "node_failed"
          : msg.includes("starting")
          ? "node_started"
          : msg.includes("completed")
          ? "node_completed"
          : "node_log"; // any other info/warn/debug log → non-destructive event

        const event: ExecutionEvent = {
          kind: kind as ExecutionEvent["kind"],
          executionId: id,
          workflowId: execution.workflowId,
          nodeId,
          nodeKind,
          payload: { message, data },
          timestamp: new Date().toISOString(),
        };
        broadcast(id, event);
      }

      res.status(201).json(logEntry);
    } catch (err) {
      logger.error("POST /internal/executions/:id/logs error", { err });
      res.status(500).json({ error: (err as Error).message });
    }
  }
);
