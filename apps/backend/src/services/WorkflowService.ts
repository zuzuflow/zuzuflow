import { Prisma } from "@prisma/client";
import { ScheduleOverlapPolicy } from "@temporalio/client";
import { z } from "zod";
import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../db/client";
import { logger } from "../logger";
import { getTemporalClient } from "../temporal/client";
import { config } from "../config";
import { tagService } from "./TagService";
import type { WorkflowTemplate, WorkflowNode, WorkflowEdge, CronConfig } from "@workflow/shared";

// =============================================================================
// Zod schema mirroring WorkflowTemplate — used to validate incoming JSON
// =============================================================================

const nodeKindSchema = z.enum([
  // Triggers
  "manual", "webhook", "cron", "mqtt_trigger", "external_trigger", "trigger_output",
  "workflow_trigger_in", "workflow_trigger_out",
  // Logical
  "if_else", "switch", "delay", "merge", "stop",
  // Utilities
  "http_request", "js_runner", "data_mapper", "json_parser",
  "html_template", "crypto_hash", "date_formatter", "base64",
  // Data & Storage
  "postgres_query", "mysql", "mongodb", "redis", "s3_bucket",
  // Communication
  "rabbitmq", "send_email", "slack", "ssh_terminal", "twilio_sms", "twilio_email",
  // AI Agents
  "llm_prompt",
  // Code
  "custom_code", "debug", "ts_runner", "python_runner",
  // Subworkflows
  "subworkflow_call", "subflow_input", "subflow_output",
  // Phase 1 extras
  "mariadb", "mssql", "google_sheets", "firebase_push", "apns_push", "loop", "response",
  // AWS Cloud
  "aws_lambda", "aws_sqs", "aws_sns", "aws_dynamodb", "aws_ses",
  "aws_secrets_manager", "aws_ssm", "aws_eventbridge", "aws_step_functions",
]);

const workflowNodeSchema = z.object({
  id: z.string().min(1),
  kind: nodeKindSchema,
  label: z.string().min(1),
  config: z.record(z.unknown()),
  position: z
    .object({ x: z.number(), y: z.number() })
    .optional(),
});

const workflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  label: z.string().optional(),
});

const workflowTemplateSchema = z
  .object({
    version: z.literal("1.0"),
    nodes: z.array(workflowNodeSchema).min(1, "Template must have at least one node"),
    edges: z.array(workflowEdgeSchema),
  })
  .refine(
    (tmpl) => tmpl.nodes.filter((n) => n.kind === "external_trigger").length <= 1,
    { message: "Workflow can contain at most one External Trigger node", path: ["nodes"] }
  );

// -----------------------------------------------------------------------------
// Stable workflow key — short, URL-safe, survives export/import
// -----------------------------------------------------------------------------

const KEY_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const KEY_REGEX = /^wf_[a-z0-9_-]{4,40}$/;

/** Generate a new stable key: `wf_` + 10 lowercase alphanumerics. */
export function generateWorkflowKey(): string {
  const bytes = randomBytes(10);
  let out = "wf_";
  for (let i = 0; i < 10; i++) {
    out += KEY_ALPHABET[bytes[i] % KEY_ALPHABET.length];
  }
  return out;
}

/** Throws VALIDATION_ERROR when a user-supplied key doesn't match the format. */
export function assertValidKeyFormat(key: string): void {
  if (!KEY_REGEX.test(key)) {
    throw Object.assign(
      new Error(
        "Invalid workflow key. Must match /^wf_[a-z0-9_-]{4,40}$/ (e.g. wf_my-workflow)."
      ),
      { code: "VALIDATION_ERROR" }
    );
  }
}

// -----------------------------------------------------------------------------
// Validation helper
// -----------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors?: z.ZodError["errors"];
}

export function validateTemplate(template: unknown): ValidationResult {
  const result = workflowTemplateSchema.safeParse(template);
  if (result.success) return { valid: true };
  return { valid: false, errors: result.error.errors };
}

// =============================================================================
// CRUD service
// =============================================================================

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  template: WorkflowTemplate;
  folderId?: string;
  isSubworkflow?: boolean;
  environmentId: string;
  tags?: string[];
  /** Optional stable key. Auto-generated when omitted. */
  key?: string;
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  template?: WorkflowTemplate;
  folderId?: string | null;
  tags?: string[];
  /** Rename the stable export/import key. Must remain unique within the env. */
  key?: string;
}

/**
 * Prisma include that pulls the tag names onto a workflow row. Used everywhere
 * we return a Workflow to the API so the response always carries `tags`.
 */
const withTags = {
  tags: { include: { tag: true } },
} as const;

/** Flatten the nested WorkflowTag→Tag into a plain string[] alongside the row. */
function flattenTags<T extends { tags?: { tag: { name: string } }[] }>(
  workflow: T
): Omit<T, "tags"> & { tags: string[] } {
  const { tags, ...rest } = workflow;
  return {
    ...(rest as Omit<T, "tags">),
    tags: (tags ?? []).map((wt) => wt.tag.name).sort(),
  };
}

export class WorkflowService {
  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------
  async createWorkflow(input: CreateWorkflowInput) {
    const validation = validateTemplate(input.template);
    if (!validation.valid) {
      throw Object.assign(new Error("Invalid workflow template"), {
        code: "VALIDATION_ERROR",
        details: validation.errors,
      });
    }

    // Determine the stable key. User-supplied keys are validated; otherwise
    // generate one and retry on the (vanishingly rare) collision.
    if (input.key !== undefined) assertValidKeyFormat(input.key);

    const workflow = await prisma.$transaction(async (tx) => {
      let created;
      let attempts = 0;
      const maxAttempts = 5;
      for (;;) {
        const key = input.key ?? generateWorkflowKey();
        try {
          created = await tx.workflow.create({
            data: {
              key,
              name: input.name,
              description: input.description,
              template: input.template as unknown as Prisma.InputJsonValue,
              status: "draft",
              version: 1,
              folderId: input.folderId ?? null,
              isSubworkflow: input.isSubworkflow ?? false,
              environmentId: input.environmentId,
            },
          });
          break;
        } catch (err) {
          // Surface user-supplied key collisions; retry on auto-generated ones.
          const isUnique =
            err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
          if (isUnique && input.key) {
            throw Object.assign(
              new Error(`Workflow key "${input.key}" already exists in this environment.`),
              { code: "CONFLICT" }
            );
          }
          if (isUnique && ++attempts < maxAttempts) continue;
          throw err;
        }
      }
      if (input.tags && input.tags.length > 0) {
        await tagService.setWorkflowTags(created.id, input.environmentId, input.tags, tx);
      }
      return tx.workflow.findUnique({
        where: { id: created.id },
        include: withTags,
      });
    });

    logger.info("Workflow created", { workflowId: workflow!.id, name: workflow!.name });
    return flattenTags(workflow!);
  }

  // ---------------------------------------------------------------------------
  // Read one
  // ---------------------------------------------------------------------------
  async getWorkflow(id: string) {
    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: withTags,
    });
    if (!workflow) {
      throw Object.assign(new Error(`Workflow ${id} not found`), {
        code: "NOT_FOUND",
      });
    }
    return flattenTags(workflow);
  }

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------
  async listWorkflows(opts: {
    environmentId: string;
    status?: string;
    folderId?: string | "root";
    /** Any-of filter: workflows tagged with at least one of these names. */
    tagsAny?: string[];
    /** All-of filter: workflows tagged with every one of these names. */
    tagsAll?: string[];
    limit?: number;
    offset?: number;
  }) {
    const { environmentId, status, folderId, tagsAny, tagsAll, limit = 100, offset = 0 } = opts;

    const where: Prisma.WorkflowWhereInput = { environmentId };
    if (status) where.status = status as Prisma.EnumWorkflowStatusFilter;
    if (folderId === "root") where.folderId = null;
    else if (folderId) where.folderId = folderId;

    if (tagsAny && tagsAny.length > 0) {
      where.tags = { some: { tag: { name: { in: tagsAny } } } };
    }
    if (tagsAll && tagsAll.length > 0) {
      // Each name must match at least one association → combine via AND
      where.AND = tagsAll.map((name) => ({
        tags: { some: { tag: { name } } },
      }));
    }

    const [total, items] = await Promise.all([
      prisma.workflow.count({ where }),
      prisma.workflow.findMany({
        where,
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          key: true,
          name: true,
          description: true,
          status: true,
          version: true,
          folderId: true,
          isSubworkflow: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { executions: true } },
          tags: { include: { tag: true } },
          executions: {
            orderBy: { startedAt: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              startedAt: true,
              completedAt: true,
            },
          },
        },
      }),
    ]);

    // Aggregate execution stats per workflow in a single query
    const workflowIds = items.map((w) => w.id);
    const execStats = workflowIds.length > 0
      ? await prisma.execution.groupBy({
          by: ["workflowId", "status"],
          where: { workflowId: { in: workflowIds } },
          _count: true,
        })
      : [];

    // Compute average duration for completed executions
    const avgDurations = workflowIds.length > 0
      ? await prisma.$queryRawUnsafe<{ workflowId: string; avgMs: number }[]>(
          `SELECT "workflowId", AVG(EXTRACT(EPOCH FROM ("completedAt" - "startedAt")) * 1000) as "avgMs"
           FROM "executions"
           WHERE "workflowId" = ANY($1) AND "status" = 'completed' AND "completedAt" IS NOT NULL
           GROUP BY "workflowId"`,
          workflowIds
        )
      : [];

    const statsMap = new Map<string, {
      totalExecutions: number;
      completed: number;
      failed: number;
      running: number;
      avgDurationMs: number | null;
    }>();

    for (const wfId of workflowIds) {
      statsMap.set(wfId, { totalExecutions: 0, completed: 0, failed: 0, running: 0, avgDurationMs: null });
    }

    for (const row of execStats) {
      const stats = statsMap.get(row.workflowId);
      if (!stats) continue;
      stats.totalExecutions += row._count;
      if (row.status === "completed") stats.completed = row._count;
      else if (row.status === "failed") stats.failed = row._count;
      else if (row.status === "running") stats.running = row._count;
    }

    for (const row of avgDurations) {
      const stats = statsMap.get(row.workflowId);
      if (stats) stats.avgDurationMs = Math.round(Number(row.avgMs));
    }

    const enrichedItems = items.map((w) => {
      const stats = statsMap.get(w.id);
      const lastExec = w.executions[0] ?? null;
      const lastDurationMs = lastExec?.completedAt && lastExec?.startedAt
        ? new Date(lastExec.completedAt).getTime() - new Date(lastExec.startedAt).getTime()
        : null;

      return {
        id: w.id,
        key: w.key,
        name: w.name,
        description: w.description,
        status: w.status,
        version: w.version,
        folderId: w.folderId,
        isSubworkflow: w.isSubworkflow,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        tags: w.tags.map((wt) => wt.tag.name).sort(),
        stats: {
          totalExecutions: stats?.totalExecutions ?? 0,
          completed: stats?.completed ?? 0,
          failed: stats?.failed ?? 0,
          running: stats?.running ?? 0,
          avgDurationMs: stats?.avgDurationMs ?? null,
          lastExecution: lastExec
            ? {
                id: lastExec.id,
                status: lastExec.status,
                startedAt: lastExec.startedAt,
                completedAt: lastExec.completedAt,
                durationMs: lastDurationMs,
              }
            : null,
        },
      };
    });

    return { total, items: enrichedItems, limit, offset };
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------
  async updateWorkflow(id: string, input: UpdateWorkflowInput) {
    const existing = await this.getWorkflow(id); // throws NOT_FOUND if missing

    if (input.template) {
      const validation = validateTemplate(input.template);
      if (!validation.valid) {
        throw Object.assign(new Error("Invalid workflow template"), {
          code: "VALIDATION_ERROR",
          details: validation.errors,
        });
      }
    }

    if (input.key !== undefined) assertValidKeyFormat(input.key);

    const workflow = await prisma.$transaction(async (tx) => {
      let updated;
      try {
        updated = await tx.workflow.update({
          where: { id },
          data: {
            ...(input.name !== undefined && { name: input.name }),
            ...(input.description !== undefined && { description: input.description }),
            ...(input.key !== undefined && { key: input.key }),
            ...(input.template !== undefined && {
              template: input.template as unknown as Prisma.InputJsonValue,
            }),
            ...("folderId" in input && { folderId: input.folderId }),
            version: { increment: 1 },
          },
        });
      } catch (err) {
        if (
          input.key &&
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          throw Object.assign(
            new Error(`Workflow key "${input.key}" already exists in this environment.`),
            { code: "CONFLICT" }
          );
        }
        throw err;
      }
      if (input.tags !== undefined) {
        await tagService.setWorkflowTags(id, updated.environmentId, input.tags, tx);
      }
      return tx.workflow.findUnique({
        where: { id },
        include: withTags,
      });
    });

    // If the workflow is active and the template changed, sync cron schedule
    if (input.template && existing.status === "active") {
      const template = input.template;
      const cronNode = template.nodes.find((n: WorkflowNode) => n.kind === "cron");

      if (cronNode) {
        // Cron node exists — upsert the Temporal schedule with the new expression
        await this._upsertCronSchedule(id, template, cronNode);
        logger.info("Cron schedule synced on workflow update", { workflowId: id });
      } else {
        // Cron node was removed — delete the Temporal schedule if it exists
        try {
          const temporal = await getTemporalClient();
          const scheduleId = `cron-wf-${id}`;
          const handle = temporal.schedule.getHandle(scheduleId);
          await handle.delete();
          logger.info("Cron schedule deleted (cron node removed)", { workflowId: id });
        } catch {
          // Schedule may not exist — ignore
        }
      }
    }

    logger.info("Workflow updated", { workflowId: id, version: workflow!.version });
    return flattenTags(workflow!);
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  async deleteWorkflow(id: string) {
    await this.getWorkflow(id); // throws NOT_FOUND if missing

    await prisma.workflow.delete({ where: { id } });
    logger.info("Workflow deleted", { workflowId: id });
  }

  // ---------------------------------------------------------------------------
  // Activate / Deactivate
  // ---------------------------------------------------------------------------
  async activateWorkflow(id: string) {
    const workflow = await this.getWorkflow(id);

    const validation = validateTemplate(workflow.template);
    if (!validation.valid) {
      throw Object.assign(
        new Error("Cannot activate workflow with an invalid template"),
        { code: "VALIDATION_ERROR", details: validation.errors }
      );
    }

    const template = workflow.template as unknown as WorkflowTemplate;
    const cronNode = template.nodes.find((n: WorkflowNode) => n.kind === "cron");

    if (cronNode) {
      // Register (or update) a durable Temporal Schedule so the workflow fires
      // automatically on the cron expression — no backend process needed.
      await this._upsertCronSchedule(id, template, cronNode);
    }

    const updated = await prisma.workflow.update({
      where: { id },
      data: { status: "active" },
    });

    logger.info("Workflow activated", { workflowId: id, hasCron: !!cronNode });
    return updated;
  }

  async deactivateWorkflow(id: string) {
    await this.getWorkflow(id);

    // Delete the Temporal Schedule if one was registered
    try {
      const temporal = await getTemporalClient();
      const scheduleId = `cron-wf-${id}`;
      const handle = temporal.schedule.getHandle(scheduleId);
      await handle.delete();
      logger.info("Temporal Schedule deleted", { scheduleId });
    } catch {
      // Schedule may not exist — ignore
    }

    const updated = await prisma.workflow.update({
      where: { id },
      data: { status: "inactive" },
    });

    logger.info("Workflow deactivated", { workflowId: id });
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Private: create or update a Temporal Schedule for a Cron-triggered workflow
  // ---------------------------------------------------------------------------
  private async _upsertCronSchedule(
    workflowId: string,
    template: WorkflowTemplate,
    cronNode: WorkflowNode
  ) {
    const cfg = cronNode.config as CronConfig;
    const temporal = await getTemporalClient();
    const scheduleId = `cron-wf-${workflowId}`;

    // Each schedule fire creates its own execution record via a sentinel value.
    // GraphInterpreter will call createExecutionRecordActivity when it sees
    // executionId === "auto".
    // Fetch the workflow's environmentId for the schedule args
    const wf = await prisma.workflow.findUnique({ where: { id: workflowId }, select: { environmentId: true } });
    const scheduleArgs = [{
      executionId: "auto",
      workflowId,
      template,
      triggerPayload: { source: "cron", expression: cfg.expression },
      environmentId: wf?.environmentId,
    }];

    try {
      await temporal.schedule.create({
        scheduleId,
        spec: {
          cronExpressions: [cfg.expression],
          timezone: cfg.timezone ?? "UTC",
        },
        action: {
          type: "startWorkflow",
          workflowType: "graphInterpreterWorkflow",
          taskQueue: config.TEMPORAL_TASK_QUEUE,
          args: scheduleArgs,
        },
        policies: {
          overlap: ScheduleOverlapPolicy.SKIP,
          catchupWindow: "1 minute",
        },
      });
      logger.info("Temporal Schedule created", { scheduleId, expression: cfg.expression });
    } catch (err: unknown) {
      // ALREADY_EXISTS → update the spec in place
      const code = (err as { code?: string })?.code ?? "";
      const message = (err as Error)?.message ?? "";
      if (code === "ALREADY_EXISTS" || message.includes("already") || message.includes("exists")) {
        const handle = temporal.schedule.getHandle(scheduleId);
        await handle.update((s) => ({
          ...s,
          spec: {
            cronExpressions: [cfg.expression],
            timezone: cfg.timezone ?? "UTC",
          },
        }));
        logger.info("Temporal Schedule updated", { scheduleId });
      } else {
        logger.warn("Could not register Temporal Schedule — workflow will still run manually", {
          scheduleId,
          err,
        });
      }
    }
  }
}

export const workflowService = new WorkflowService();
