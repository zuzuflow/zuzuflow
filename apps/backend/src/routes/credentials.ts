import { Router, Request, Response } from "express";
import { credentialService } from "../services/CredentialService";
import { logger } from "../logger";

// =============================================================================
// Credential routes — CRUD for stored secrets
// =============================================================================

export const credentialRouter: import("express").Router = Router();

function errorToStatus(err: unknown): number {
  if (err instanceof Error) {
    const code = (err as any).code as string | undefined;
    if (code === "NOT_FOUND") return 404;
    if (code === "CONFLICT") return 409;
  }
  return 500;
}

// GET /credentials — list all (no secret data returned)
credentialRouter.get("/", async (req: Request, res: Response) => {
  try {
    const environmentId = (req as any).environmentId as string;
    const items = await credentialService.listCredentials(environmentId);
    res.json(items);
  } catch (err) {
    logger.error("GET /credentials error", { err });
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /credentials — create a new credential
credentialRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { name, kind, data } = req.body as {
      name: string;
      kind: string;
      data: Record<string, string>;
    };
    if (!name || !kind || !data) {
      return res.status(400).json({ error: "name, kind, and data are required" });
    }
    const environmentId = (req as any).environmentId as string;
    const cred = await credentialService.createCredential({ name, kind, data, environmentId });
    res.status(201).json(cred);
  } catch (err) {
    logger.error("POST /credentials error", { err });
    res.status(errorToStatus(err)).json({ error: (err as Error).message });
  }
});

// PUT /credentials/:id — update name or data
credentialRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const { name, data } = req.body as { name?: string; data?: Record<string, string> };
    const cred = await credentialService.updateCredential(req.params.id, { name, data });
    res.json(cred);
  } catch (err) {
    logger.error("PUT /credentials/:id error", { err });
    res.status(errorToStatus(err)).json({ error: (err as Error).message });
  }
});

// DELETE /credentials/:id
credentialRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    await credentialService.deleteCredential(req.params.id);
    res.status(204).end();
  } catch (err) {
    logger.error("DELETE /credentials/:id error", { err });
    res.status(errorToStatus(err)).json({ error: (err as Error).message });
  }
});
