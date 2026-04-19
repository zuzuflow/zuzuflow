import { createHash, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/client";
import { logger } from "../logger";
import type {
  CustomBuilderConfig,
  CustomBuilderHandle,
  CustomBuilderInputField,
  CustomBuilderHttpTemplate,
} from "@workflow/shared";

// =============================================================================
// Stable template key — parallels generateWorkflowKey ("wf_" + 10 chars)
// =============================================================================

const KEY_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const KEY_REGEX = /^cn_[a-z0-9_-]{4,40}$/;

export function generateCustomNodeKey(): string {
  const bytes = randomBytes(10);
  let out = "cn_";
  for (let i = 0; i < 10; i++) {
    out += KEY_ALPHABET[bytes[i] % KEY_ALPHABET.length];
  }
  return out;
}

export function assertValidCustomNodeKey(key: string): void {
  if (!KEY_REGEX.test(key)) {
    throw Object.assign(
      new Error(
        "Invalid custom node key. Must match /^cn_[a-z0-9_-]{4,40}$/ (e.g. cn_slugify).",
      ),
      { code: "VALIDATION_ERROR" },
    );
  }
}

// =============================================================================
// Zod — mirrors CustomBuilder types in @workflow/shared
// =============================================================================

const handleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

const inputFieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum([
    "string",
    "number",
    "boolean",
    "select",
    "textarea",
    "json",
    "credential",
  ]),
  required: z.boolean().optional(),
  default: z.unknown().optional(),
  options: z
    .array(z.object({ value: z.string(), label: z.string() }))
    .optional(),
  description: z.string().optional(),
});

const httpTemplateSchema = z.object({
  method: z.string().min(1),
  url: z.string().min(1),
  headers: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .optional(),
  queryParams: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .optional(),
  bodyTemplate: z.string().optional(),
});

const handlesSchema = z.object({
  inputs: z.array(handleSchema),
  outputs: z.array(handleSchema).min(1, "Must declare at least one output"),
});

export const customNodeTemplateInputSchema = z
  .object({
    name: z.string().min(1).max(80),
    description: z.string().max(2000).optional(),
    icon: z.string().min(1).max(80).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    category: z.string().min(1).max(40).optional(),
    handles: handlesSchema,
    inputsSchema: z.array(inputFieldSchema),
    executionMode: z.enum(["sandbox", "http"]),
    code: z.string().optional(),
    httpTemplate: httpTemplateSchema.optional(),
    credentialType: z.string().max(80).optional(),
    isPublic: z.boolean().optional(),
    key: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.executionMode === "sandbox" && !v.code) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["code"],
        message: "Sandbox templates require `code`",
      });
    }
    if (v.executionMode === "http" && !v.httpTemplate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["httpTemplate"],
        message: "HTTP templates require `httpTemplate`",
      });
    }
  });

export type CustomNodeTemplateInput = z.infer<
  typeof customNodeTemplateInputSchema
>;

// Minimum fields required from a snapshot when auto-installing a template
// from a workflow that was imported without the template present.
const snapshotSchema = z.object({
  templateKey: z.string(),
  name: z.string(),
  icon: z.string().optional(),
  color: z.string().optional(),
  category: z.string().optional(),
  inputs: z.array(handleSchema),
  outputs: z.array(handleSchema).min(1),
  inputsSchema: z.array(inputFieldSchema),
  executionMode: z.enum(["sandbox", "http"]),
  code: z.string().optional(),
  httpTemplate: httpTemplateSchema.optional(),
  credentialType: z.string().optional(),
  templateVersion: z.number().int().positive().optional(),
});

// =============================================================================
// Hashing — content fingerprint for drift detection
// =============================================================================

/** Stable JSON stringify — sorted keys so hashes match across runs. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          canonicalJson((value as Record<string, unknown>)[k]),
      )
      .join(",") +
    "}"
  );
}

export function hashTemplatePayload(payload: unknown): string {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

// =============================================================================
// CRUD service
// =============================================================================

const templateSelect = {
  id: true,
  organizationId: true,
  key: true,
  name: true,
  description: true,
  icon: true,
  color: true,
  category: true,
  handles: true,
  inputsSchema: true,
  executionMode: true,
  code: true,
  httpTemplate: true,
  credentialType: true,
  isPublic: true,
  gitSyncedAt: true,
  originHash: true,
  version: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type CustomNodeTemplate = Prisma.CustomNodeTemplateGetPayload<{
  select: typeof templateSelect;
}>;

export class CustomNodeService {
  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  /**
   * Templates visible to the caller's org = own templates + any `isPublic`
   * template from another org on this instance. Org-scoped only (not env).
   */
  async listForOrg(organizationId: string): Promise<CustomNodeTemplate[]> {
    return prisma.customNodeTemplate.findMany({
      where: {
        OR: [{ organizationId }, { isPublic: true }],
      },
      orderBy: { name: "asc" },
      select: templateSelect,
    });
  }

  async getById(id: string): Promise<CustomNodeTemplate> {
    const template = await prisma.customNodeTemplate.findUnique({
      where: { id },
      select: templateSelect,
    });
    if (!template) {
      throw Object.assign(new Error(`Custom node template ${id} not found`), {
        code: "NOT_FOUND",
      });
    }
    return template;
  }

  async getByKey(
    organizationId: string,
    key: string,
  ): Promise<CustomNodeTemplate | null> {
    return prisma.customNodeTemplate.findUnique({
      where: { organizationId_key: { organizationId, key } },
      select: templateSelect,
    });
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(opts: {
    organizationId: string;
    input: CustomNodeTemplateInput;
    createdById?: string | null;
  }): Promise<CustomNodeTemplate> {
    const parsed = customNodeTemplateInputSchema.safeParse(opts.input);
    if (!parsed.success) {
      throw Object.assign(new Error("Invalid custom node template"), {
        code: "VALIDATION_ERROR",
        details: parsed.error.errors,
      });
    }
    const value = parsed.data;
    if (value.key !== undefined) assertValidCustomNodeKey(value.key);

    let attempts = 0;
    for (;;) {
      const key = value.key ?? generateCustomNodeKey();
      try {
        const created = await prisma.customNodeTemplate.create({
          data: {
            organizationId: opts.organizationId,
            key,
            name: value.name,
            description: value.description,
            icon: value.icon ?? "Puzzle",
            color: value.color ?? "#8b5cf6",
            category: value.category ?? "utilities",
            handles: value.handles as unknown as Prisma.InputJsonValue,
            inputsSchema:
              value.inputsSchema as unknown as Prisma.InputJsonValue,
            executionMode: value.executionMode,
            code: value.code ?? null,
            httpTemplate: value.httpTemplate
              ? (value.httpTemplate as unknown as Prisma.InputJsonValue)
              : Prisma.DbNull,
            credentialType: value.credentialType ?? null,
            isPublic: value.isPublic ?? false,
            createdById: opts.createdById ?? null,
            version: 1,
          },
          select: templateSelect,
        });
        logger.info("Custom node template created", {
          templateId: created.id,
          key: created.key,
          name: created.name,
        });
        return created;
      } catch (err) {
        const isUnique =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002";
        if (isUnique && value.key) {
          throw Object.assign(
            new Error(
              `Custom node key "${value.key}" already exists in this organization.`,
            ),
            { code: "CONFLICT" },
          );
        }
        if (isUnique && ++attempts < 5) continue;
        throw err;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async update(opts: {
    id: string;
    organizationId: string;
    patch: Partial<CustomNodeTemplateInput>;
  }): Promise<CustomNodeTemplate> {
    const existing = await this.getById(opts.id);
    if (existing.organizationId !== opts.organizationId) {
      throw Object.assign(new Error("Template belongs to another org"), {
        code: "FORBIDDEN",
      });
    }

    // Re-validate the merged record so partial updates still round-trip as
    // complete, valid templates.
    const merged = {
      name: opts.patch.name ?? existing.name,
      description: opts.patch.description ?? existing.description ?? undefined,
      icon: opts.patch.icon ?? existing.icon,
      color: opts.patch.color ?? existing.color,
      category: opts.patch.category ?? existing.category,
      handles: (opts.patch.handles ?? existing.handles) as CustomNodeTemplateInput["handles"],
      inputsSchema: (opts.patch.inputsSchema ??
        existing.inputsSchema) as CustomNodeTemplateInput["inputsSchema"],
      executionMode:
        opts.patch.executionMode ??
        (existing.executionMode as CustomNodeTemplateInput["executionMode"]),
      code: opts.patch.code ?? existing.code ?? undefined,
      httpTemplate:
        opts.patch.httpTemplate ??
        ((existing.httpTemplate as unknown as CustomBuilderHttpTemplate | null) ??
          undefined),
      credentialType:
        opts.patch.credentialType ?? existing.credentialType ?? undefined,
      isPublic: opts.patch.isPublic ?? existing.isPublic,
    };
    const parsed = customNodeTemplateInputSchema.safeParse(merged);
    if (!parsed.success) {
      throw Object.assign(new Error("Invalid custom node template"), {
        code: "VALIDATION_ERROR",
        details: parsed.error.errors,
      });
    }

    const updated = await prisma.customNodeTemplate.update({
      where: { id: opts.id },
      data: {
        name: merged.name,
        description: merged.description ?? null,
        icon: merged.icon,
        color: merged.color,
        category: merged.category,
        handles: merged.handles as unknown as Prisma.InputJsonValue,
        inputsSchema: merged.inputsSchema as unknown as Prisma.InputJsonValue,
        executionMode: merged.executionMode,
        code: merged.code ?? null,
        httpTemplate: merged.httpTemplate
          ? (merged.httpTemplate as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        credentialType: merged.credentialType ?? null,
        isPublic: merged.isPublic,
        version: { increment: 1 },
      },
      select: templateSelect,
    });
    logger.info("Custom node template updated", {
      templateId: updated.id,
      version: updated.version,
    });
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async delete(opts: { id: string; organizationId: string }): Promise<void> {
    const existing = await this.getById(opts.id);
    if (existing.organizationId !== opts.organizationId) {
      throw Object.assign(new Error("Template belongs to another org"), {
        code: "FORBIDDEN",
      });
    }
    await prisma.customNodeTemplate.delete({ where: { id: opts.id } });
    logger.info("Custom node template deleted", { templateId: opts.id });
  }

  // ---------------------------------------------------------------------------
  // Auto-install from snapshot — the "workflow imported with a template the
  // target org hasn't seen yet" safety net. Called from WorkflowService before
  // returning on every create/update code path, plus from GitService during
  // workflow pull.
  // ---------------------------------------------------------------------------

  /**
   * Given a workflow template, scan its `custom_builder` nodes and insert any
   * template whose (organizationId, templateKey) does not already exist. Never
   * mutates an existing template — snapshot-on-drop invariant.
   *
   * Returns the number of templates auto-installed for observability.
   */
  async ensureTemplatesExist(
    organizationId: string,
    nodes: Array<{ kind?: string; config?: unknown }>,
  ): Promise<number> {
    let installed = 0;
    for (const node of nodes) {
      if (node.kind !== "custom_builder") continue;
      const parsed = snapshotSchema.safeParse(node.config);
      if (!parsed.success) {
        // The workflow-level Zod schema will have caught this — but double-guard
        // to avoid crashing the import pipeline if a malformed snapshot arrives.
        continue;
      }
      const snap = parsed.data;
      const existing = await this.getByKey(organizationId, snap.templateKey);
      if (existing) continue;

      try {
        await prisma.customNodeTemplate.create({
          data: {
            organizationId,
            key: snap.templateKey,
            name: snap.name,
            icon: snap.icon ?? "Puzzle",
            color: snap.color ?? "#8b5cf6",
            category: snap.category ?? "utilities",
            handles: {
              inputs: snap.inputs,
              outputs: snap.outputs,
            } as unknown as Prisma.InputJsonValue,
            inputsSchema:
              snap.inputsSchema as unknown as Prisma.InputJsonValue,
            executionMode: snap.executionMode,
            code: snap.code ?? null,
            httpTemplate: snap.httpTemplate
              ? (snap.httpTemplate as unknown as Prisma.InputJsonValue)
              : Prisma.DbNull,
            credentialType: snap.credentialType ?? null,
            version: snap.templateVersion ?? 1,
          },
        });
        installed += 1;
        logger.info("Custom node template auto-installed from snapshot", {
          organizationId,
          templateKey: snap.templateKey,
        });
      } catch (err) {
        // Race: another request auto-installed the same key between our check
        // and insert. Treat as a no-op.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          continue;
        }
        throw err;
      }
    }
    return installed;
  }

  // ---------------------------------------------------------------------------
  // Build a CustomBuilderConfig snapshot from a template — used by the
  // frontend drop handler's server-side counterpart and by import paths.
  // ---------------------------------------------------------------------------

  toSnapshot(template: CustomNodeTemplate): CustomBuilderConfig {
    const handles = template.handles as unknown as {
      inputs: CustomBuilderHandle[];
      outputs: CustomBuilderHandle[];
    };
    const schemaFields =
      template.inputsSchema as unknown as CustomBuilderInputField[];
    const defaults: Record<string, unknown> = {};
    for (const field of schemaFields) {
      if (field.default !== undefined) defaults[field.name] = field.default;
    }
    return {
      templateId: template.id,
      templateKey: template.key,
      templateVersion: template.version,
      name: template.name,
      icon: template.icon,
      color: template.color,
      category: template.category,
      inputs: handles.inputs,
      outputs: handles.outputs,
      inputsSchema: schemaFields,
      executionMode: template.executionMode as "sandbox" | "http",
      code: template.code ?? undefined,
      httpTemplate:
        (template.httpTemplate as unknown as CustomBuilderHttpTemplate | null) ??
        undefined,
      credentialType: template.credentialType ?? undefined,
      templateInputs: defaults,
      credentialRef: null,
    };
  }
}

export const customNodeService = new CustomNodeService();
