import { Router, Request, Response } from "express";
import {
  customNodeService,
  customNodeTemplateInputSchema,
} from "../services/CustomNodeService";
import { orgSettingsService } from "../services/OrgSettingsService";
import { gitService } from "../services/GitService";
import { logger } from "../logger";

export const customNodeRouter: Router = Router();

function errStatus(err: unknown): number {
  const code = (err as { code?: string })?.code;
  if (code === "NOT_FOUND") return 404;
  if (code === "FORBIDDEN") return 403;
  if (code === "CONFLICT") return 409;
  if (code === "VALIDATION_ERROR") return 422;
  return 500;
}

function errorBody(err: unknown) {
  const e = err as { message?: string; code?: string; details?: unknown };
  return {
    error: e.message ?? "Internal server error",
    code: e.code,
    details: e.details,
  };
}

function requireOrg(req: Request, res: Response): string | null {
  const orgId = (req as unknown as { organizationId?: string | null })
    .organizationId;
  if (!orgId) {
    res
      .status(403)
      .json({ error: "Custom nodes require an organization context" });
    return null;
  }
  return orgId;
}

// GET /api/custom-nodes — list visible templates (own org + public)
customNodeRouter.get("/", async (req: Request, res: Response) => {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const items = await customNodeService.listForOrg(orgId);
    res.json({ items });
  } catch (err) {
    logger.error("GET /custom-nodes", { err });
    res.status(errStatus(err)).json(errorBody(err));
  }
});

// GET /api/custom-nodes/:id — fetch one
customNodeRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const tpl = await customNodeService.getById(req.params.id);
    if (tpl.organizationId !== orgId && !tpl.isPublic) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json(tpl);
  } catch (err) {
    logger.error("GET /custom-nodes/:id", { err });
    res.status(errStatus(err)).json(errorBody(err));
  }
});

// POST /api/custom-nodes — create
customNodeRouter.post("/", async (req: Request, res: Response) => {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const userId =
      (req as unknown as { userId?: string | null }).userId ?? null;
    const parsed = customNodeTemplateInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        error: "Invalid custom node template",
        code: "VALIDATION_ERROR",
        details: parsed.error.errors,
      });
    }
    const created = await customNodeService.create({
      organizationId: orgId,
      input: parsed.data,
      createdById: userId,
    });
    gitService.scheduleAutoPush(`custom-node.create:${created.id}`);
    res.status(201).json(created);
  } catch (err) {
    logger.error("POST /custom-nodes", { err });
    res.status(errStatus(err)).json(errorBody(err));
  }
});

// PATCH /api/custom-nodes/:id — update
customNodeRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const updated = await customNodeService.update({
      id: req.params.id,
      organizationId: orgId,
      patch: req.body ?? {},
    });
    gitService.scheduleAutoPush(`custom-node.update:${updated.id}`);
    res.json(updated);
  } catch (err) {
    logger.error("PATCH /custom-nodes/:id", { err });
    res.status(errStatus(err)).json(errorBody(err));
  }
});

// POST /api/custom-nodes/generate — AI-assisted draft template
//
// Does NOT persist — returns a draft JSON blob for the builder modal to
// review. Reuses the org's configured LLM provider via OrgSettingsService.
customNodeRouter.post("/generate", async (req: Request, res: Response) => {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const { prompt } = (req.body ?? {}) as { prompt?: string };
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const settings = await orgSettingsService.getAiSettings(orgId);
    if (!settings.aiBuilderEnabled) {
      return res
        .status(403)
        .json({ error: "AI Builder is not enabled for this organization" });
    }
    if (!settings.aiProvider || !settings.hasApiKey) {
      return res
        .status(400)
        .json({ error: "AI provider and API key must be configured" });
    }
    const apiKey = await orgSettingsService.getDecryptedApiKey(orgId);
    if (!apiKey) {
      return res.status(400).json({ error: "API key not found" });
    }

    const draft = await callLlmForCustomNode(
      settings.aiProvider,
      settings.aiModel ?? "gpt-4o",
      apiKey,
      prompt.trim(),
    );
    return res.json(draft);
  } catch (err) {
    logger.error("POST /custom-nodes/generate", { err });
    res.status(errStatus(err)).json(errorBody(err));
  }
});

// DELETE /api/custom-nodes/:id — delete
customNodeRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    await customNodeService.delete({
      id: req.params.id,
      organizationId: orgId,
    });
    gitService.scheduleAutoPush(`custom-node.delete:${req.params.id}`);
    res.status(204).send();
  } catch (err) {
    logger.error("DELETE /custom-nodes/:id", { err });
    res.status(errStatus(err)).json(errorBody(err));
  }
});

// ---------------------------------------------------------------------------
// AI Generate helper — parallels callLlmForWorkflow in routes/auth.ts but
// returns a draft custom-node template, not a workflow graph.
// ---------------------------------------------------------------------------

const CUSTOM_NODE_SYSTEM_PROMPT = `You are a code generator for a visual workflow automation platform.

Given a user's one-line description of a reusable "custom node", return a JSON object describing the node. Respond with ONLY JSON — no prose, no code fences.

Schema:
{
  "name": "<short human name>",
  "description": "<one sentence>",
  "icon": "<Lucide icon name, e.g. Puzzle, Link, Mail, Database>",
  "color": "#rrggbb",
  "category": "<one of: trigger, logical, utilities, data_storage, communication, ai_agents, code, cloud>",
  "handles": {
    "inputs":  [{ "id": "in",  "label": "in" }],
    "outputs": [{ "id": "out", "label": "out" }]
  },
  "inputsSchema": [
    { "name": "<stable key>", "label": "<UI label>", "type": "string|number|boolean|select|textarea|json", "required": true, "default": "optional", "description": "optional" }
  ],
  "executionMode": "sandbox",
  "code": "async function run(input) {\\n  const { fields, context } = input;\\n  return { result: ... };\\n}"
}

Rules:
- Always use executionMode = "sandbox".
- The code MUST define \`async function run(input)\` and return a plain JSON-serializable value.
- Access user input values via \`input.fields.<name>\`, upstream node outputs via \`input.context\`.
- No imports, no require(), no filesystem / network — only pure JS and Math/Date/JSON.
- Prefer simple, obviously-correct code over cleverness.
- When the task has multiple success/failure paths, declare extra output handles and return { __handle: "<id>", value: ... }.`;

async function callLlmForCustomNode(
  provider: string,
  model: string,
  apiKey: string,
  userPrompt: string,
): Promise<unknown> {
  let url: string;
  let headers: Record<string, string>;
  let body: unknown;

  switch (provider) {
    case "openai":
      url = "https://api.openai.com/v1/chat/completions";
      headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      body = {
        model,
        messages: [
          { role: "system", content: CUSTOM_NODE_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      };
      break;
    case "anthropic":
      url = "https://api.anthropic.com/v1/messages";
      headers = {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      };
      body = {
        model,
        system: CUSTOM_NODE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.2,
        max_tokens: 2000,
      };
      break;
    case "gemini":
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      headers = { "Content-Type": "application/json" };
      body = {
        systemInstruction: { parts: [{ text: CUSTOM_NODE_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
      };
      break;
    default:
      throw Object.assign(new Error(`Unsupported AI provider: ${provider}`), {
        code: "VALIDATION_ERROR",
      });
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `LLM API error (${response.status}): ${text.slice(0, 200)}`,
    );
  }
  const json = (await response.json()) as Record<string, unknown>;
  let content = "";
  if (provider === "openai") {
    content =
      ((json.choices as Array<{ message?: { content?: string } }>) ?? [])[0]
        ?.message?.content ?? "";
  } else if (provider === "anthropic") {
    content = ((json.content as Array<{ text?: string }>) ?? [])[0]?.text ?? "";
  } else if (provider === "gemini") {
    content =
      ((json.candidates as Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>) ?? [])[0]?.content?.parts?.[0]?.text ?? "";
  }

  // Strip markdown fences the model may add despite instructions.
  content = content
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  let draft: unknown;
  try {
    draft = JSON.parse(content);
  } catch {
    throw Object.assign(
      new Error("LLM returned non-JSON content — cannot parse as custom node"),
      { code: "VALIDATION_ERROR" },
    );
  }

  // Validate against the same input schema we use for manual creation so we
  // never hand the frontend something the save endpoint would reject.
  const parsed = customNodeTemplateInputSchema.safeParse(draft);
  if (!parsed.success) {
    throw Object.assign(
      new Error("LLM output did not match the custom node schema"),
      {
        code: "VALIDATION_ERROR",
        details: parsed.error.errors,
      },
    );
  }
  return parsed.data;
}
