import { Router, Request, Response } from "express";
import { variableService } from "../services/VariableService";
import { logger } from "../logger";

export const variableRouter: import("express").Router = Router();

function errorToStatus(err: unknown): number {
  const code = (err as any).code as string | undefined;
  if (code === "NOT_FOUND") return 404;
  if (code === "CONFLICT") return 409;
  return 500;
}

// GET /variables
variableRouter.get("/", async (req: Request, res: Response) => {
  try {
    const environmentId = (req as any).environmentId as string;
    res.json(await variableService.listVariables(environmentId));
  } catch (err) {
    logger.error("GET /variables", { err });
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /variables
variableRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { key, value, description, isSecret } = req.body as {
      key: string; value: string; description?: string; isSecret?: boolean;
    };
    if (!key || value === undefined) return res.status(400).json({ error: "key and value are required" });
    const environmentId = (req as any).environmentId as string;
    const v = await variableService.createVariable({ key, value, description, isSecret, environmentId });
    res.status(201).json(v);
  } catch (err) {
    logger.error("POST /variables", { err });
    res.status(errorToStatus(err)).json({ error: (err as Error).message });
  }
});

// PUT /variables/:id
variableRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const { key, value, description } = req.body as {
      key?: string; value?: string; description?: string;
    };
    res.json(await variableService.updateVariable(req.params.id, { key, value, description }));
  } catch (err) {
    logger.error("PUT /variables/:id", { err });
    res.status(errorToStatus(err)).json({ error: (err as Error).message });
  }
});

// DELETE /variables/:id
variableRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    await variableService.deleteVariable(req.params.id);
    res.status(204).end();
  } catch (err) {
    logger.error("DELETE /variables/:id", { err });
    res.status(errorToStatus(err)).json({ error: (err as Error).message });
  }
});
