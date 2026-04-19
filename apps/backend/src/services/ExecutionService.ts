import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { WorkflowExecutionAlreadyStartedError } from "@temporalio/client";
import { prisma } from "../db/client";
import { getTemporalClient } from "../temporal/client";
import { config } from "../config";
import { logger } from "../logger";
import { taskQueueResolver } from "./TaskQueueResolver";
import type { WorkflowTemplate } from "@workflow/shared";

// =============================================================================
// ExecutionService — bridges the REST API and Temporal workflows
// =============================================================================

export interface StartExecutionInput {
  workflowId: string;
  triggerPayload?: Record<string, unknown>;
  environmentId: string;
}

export class ExecutionService {
  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  async startExecution(input: StartExecutionInput) {
    const { workflowId, triggerPayload = {}, environmentId } = input;

    // Load the workflow along with its environment → org chain so we can
    // resolve which Temporal task queue this execution should land on (see
    // TaskQueueResolver).
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        environment: { select: { organizationId: true } },
      },
    });
    if (!workflow) {
      throw Object.assign(new Error(`Workflow ${workflowId} not found`), {
        code: "NOT_FOUND",
      });
    }
    if (workflow.status !== "active") {
      throw Object.assign(
        new Error(`Workflow ${workflowId} is not active (status: ${workflow.status})`),
        { code: "WORKFLOW_INACTIVE" }
      );
    }

    // Create the execution record first so we have an ID to pass to Temporal
    const execution = await prisma.execution.create({
      data: {
        workflowId,
        status: "pending",
        triggerPayload: triggerPayload as unknown as Prisma.InputJsonValue,
        environmentId,
      },
    });

    const temporalWorkflowId = `wf-${workflowId}-${execution.id}`;

    try {
      const temporal = await getTemporalClient();

      const template = workflow.template as unknown as WorkflowTemplate;
      const ws = template.settings ?? {};

      const taskQueue = await taskQueueResolver.resolveTaskQueue(
        workflow.environment?.organizationId,
      );
      const startOptions: Record<string, unknown> = {
        taskQueue,
        workflowId: temporalWorkflowId,
        args: [
          {
            executionId: execution.id,
            workflowId,
            template,
            triggerPayload,
            environmentId,
          },
        ],
      };
      if (ws.workflowExecutionTimeout) startOptions.workflowExecutionTimeout = ws.workflowExecutionTimeout;
      if (ws.workflowRunTimeout) startOptions.workflowRunTimeout = ws.workflowRunTimeout;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = await temporal.workflow.start("graphInterpreterWorkflow", startOptions as any);

      // Update execution with Temporal IDs
      const updated = await prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: "running",
          temporalWorkflowId: handle.workflowId,
          temporalRunId: handle.firstExecutionRunId,
          startedAt: new Date(),
        },
      });

      logger.info("Execution started", {
        executionId: execution.id,
        workflowId,
        temporalWorkflowId: handle.workflowId,
      });

      return updated;
    } catch (err) {
      if (err instanceof WorkflowExecutionAlreadyStartedError) {
        throw Object.assign(new Error("An execution for this workflow is already running"), {
          code: "ALREADY_STARTED",
        });
      }

      // Mark execution as failed
      await prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
          completedAt: new Date(),
        },
      });

      logger.error("Failed to start Temporal workflow", { err, workflowId });
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Get one
  // ---------------------------------------------------------------------------
  async getExecution(id: string) {
    const execution = await prisma.execution.findUnique({
      where: { id },
      include: {
        logs: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!execution) {
      throw Object.assign(new Error(`Execution ${id} not found`), {
        code: "NOT_FOUND",
      });
    }
    return execution;
  }

  // ---------------------------------------------------------------------------
  // Get filtered logs for an execution
  // ---------------------------------------------------------------------------
  async getExecutionLogs(
    executionId: string,
    opts: {
      nodeId?: string;
      nodeKind?: string;
      level?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const { nodeId, nodeKind, level, search, limit = 200, offset = 0 } = opts;

    // Verify execution exists
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      select: { id: true, status: true, workflowId: true, startedAt: true, completedAt: true },
    });
    if (!execution) {
      throw Object.assign(new Error(`Execution ${executionId} not found`), {
        code: "NOT_FOUND",
      });
    }

    const where: Prisma.ExecutionLogWhereInput = { executionId };
    if (nodeId) where.nodeId = nodeId;
    if (nodeKind) where.nodeKind = nodeKind;
    if (level) {
      // Support comma-separated levels: "info,warn,error"
      const levels = level.split(",").map((l) => l.trim());
      if (levels.length === 1) {
        where.level = levels[0] as any;
      } else {
        where.level = { in: levels as any };
      }
    }
    if (search) {
      where.message = { contains: search, mode: "insensitive" };
    }

    const [total, logs] = await Promise.all([
      prisma.executionLog.count({ where }),
      prisma.executionLog.findMany({
        where,
        orderBy: { createdAt: "asc" },
        take: limit,
        skip: offset,
      }),
    ]);

    // Collect distinct nodeId+nodeKind pairs for filter dropdowns
    const nodesMeta = await prisma.executionLog.findMany({
      where: { executionId },
      distinct: ["nodeId", "nodeKind"],
      select: { nodeId: true, nodeKind: true },
      orderBy: { createdAt: "asc" },
    });

    return { execution, total, logs, nodes: nodesMeta, limit, offset };
  }

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------
  async listExecutions(opts: {
    environmentId: string;
    workflowId?: string;
    status?: string;
    /** Free-text search matched case-insensitively against error message and workflow name */
    q?: string;
    /** ISO timestamp; include executions with startedAt >= from */
    from?: string;
    /** ISO timestamp; include executions with startedAt <= to */
    to?: string;
    limit?: number;
    offset?: number;
  }) {
    const { environmentId, workflowId, status, q, from, to, limit = 50, offset = 0 } = opts;

    const where: Prisma.ExecutionWhereInput = { environmentId };
    if (workflowId) where.workflowId = workflowId;
    if (status) where.status = status as Prisma.EnumExecutionStatusFilter;

    // Date range filter on startedAt (indexed via createdAt ordering; scan cost bounded by limit)
    if (from || to) {
      where.startedAt = {};
      if (from) (where.startedAt as Prisma.DateTimeFilter).gte = new Date(from);
      if (to) (where.startedAt as Prisma.DateTimeFilter).lte = new Date(to);
    }

    // Free-text search — match either the error message or the parent workflow name
    if (q && q.trim().length > 0) {
      const term = q.trim();
      where.OR = [
        { error: { contains: term, mode: "insensitive" } },
        { workflow: { is: { name: { contains: term, mode: "insensitive" } } } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.execution.count({ where }),
      prisma.execution.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          workflow: { select: { id: true, name: true } },
        },
      }),
    ]);

    return { total, items, limit, offset };
  }

  // ---------------------------------------------------------------------------
  // Cross-execution log-line search (Grafana-style)
  //
  // Queries ExecutionLog directly across every execution in the environment
  // (optionally scoped to a workflow / node-kind / level / time range), so
  // print/console.log output from any run becomes searchable.
  // ---------------------------------------------------------------------------
  async searchLogs(opts: {
    environmentId: string;
    q?: string;
    level?: string;
    workflowId?: string;
    nodeKind?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) {
    const {
      environmentId,
      q,
      level,
      workflowId,
      nodeKind,
      from,
      to,
      limit = 100,
      offset = 0,
    } = opts;

    const executionFilter: Prisma.ExecutionWhereInput = { environmentId };
    if (workflowId) executionFilter.workflowId = workflowId;

    const where: Prisma.ExecutionLogWhereInput = {
      execution: { is: executionFilter },
    };

    if (q && q.trim().length > 0) {
      where.message = { contains: q.trim(), mode: "insensitive" };
    }
    if (level) {
      const levels = level.split(",").map((l) => l.trim()).filter(Boolean);
      if (levels.length === 1) {
        where.level = levels[0] as any;
      } else if (levels.length > 1) {
        where.level = { in: levels as any };
      }
    }
    if (nodeKind) where.nodeKind = nodeKind;
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(from);
      if (to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(to);
    }

    const [total, items] = await Promise.all([
      prisma.executionLog.count({ where }),
      prisma.executionLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          execution: {
            select: {
              id: true,
              status: true,
              workflowId: true,
              workflow: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    return { total, items, limit, offset };
  }

  // ---------------------------------------------------------------------------
  // Cancel
  // ---------------------------------------------------------------------------
  async cancelExecution(id: string) {
    const execution = await prisma.execution.findUnique({ where: { id } });
    if (!execution) {
      throw Object.assign(new Error(`Execution ${id} not found`), {
        code: "NOT_FOUND",
      });
    }

    const terminalStatuses = ["completed", "failed", "cancelled", "timed_out"];

    // Already finished — just delete the record
    if (terminalStatuses.includes(execution.status)) {
      await prisma.executionLog.deleteMany({ where: { executionId: id } });
      await prisma.execution.delete({ where: { id } });
      logger.info("Execution deleted", { executionId: id });
      return null;
    }

    // Still running — cancel on Temporal first
    if (execution.temporalWorkflowId) {
      try {
        const temporal = await getTemporalClient();
        const handle = temporal.workflow.getHandle(execution.temporalWorkflowId);
        await handle.cancel();
        logger.info("Temporal workflow cancellation requested", {
          executionId: id,
          temporalWorkflowId: execution.temporalWorkflowId,
        });
      } catch (err) {
        logger.warn("Could not cancel Temporal workflow (may have already completed)", {
          err,
          executionId: id,
        });
      }
    }

    const updated = await prisma.execution.update({
      where: { id },
      data: {
        status: "cancelled",
        completedAt: new Date(),
      },
    });

    logger.info("Execution cancelled", { executionId: id });
    return updated;
  }
}

export const executionService = new ExecutionService();
