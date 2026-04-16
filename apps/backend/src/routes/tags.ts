import { Router, Request, Response } from "express";
import { tagService } from "../services/TagService";
import { logger } from "../logger";

// =============================================================================
// Tag routes — environment-scoped list / rename / delete
// Mounted at /env/:slug/tags
// =============================================================================

export const tagRouter: import("express").Router = Router();

function errorToStatus(err: unknown): number {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException & { code?: string }).code;
    if (code === "NOT_FOUND") return 404;
    if (code === "VALIDATION_ERROR") return 422;
    if (code === "CONFLICT") return 409;
  }
  return 500;
}

// GET /tags — list tags in this environment with usage counts
tagRouter.get("/", async (req: Request, res: Response) => {
  try {
    const environmentId = (req as any).environmentId as string;
    const tags = await tagService.listTags(environmentId);
    res.json(tags);
  } catch (err) {
    logger.error("GET /tags error", { err });
    res.status(errorToStatus(err)).json({ error: (err as Error).message });
  }
});

// PATCH /tags/:name — rename / recolor
tagRouter.patch("/:name", async (req: Request, res: Response) => {
  try {
    const environmentId = (req as any).environmentId as string;
    const { name: newName, color } = req.body as { name?: string; color?: string | null };
    const updated = await tagService.updateTag(environmentId, req.params.name, {
      name: newName,
      color,
    });
    res.json(updated);
  } catch (err) {
    logger.error("PATCH /tags/:name error", { err, name: req.params.name });
    res.status(errorToStatus(err)).json({ error: (err as Error).message });
  }
});

// DELETE /tags/:name — remove tag and every association
tagRouter.delete("/:name", async (req: Request, res: Response) => {
  try {
    const environmentId = (req as any).environmentId as string;
    await tagService.deleteTag(environmentId, req.params.name);
    res.status(204).send();
  } catch (err) {
    logger.error("DELETE /tags/:name error", { err, name: req.params.name });
    res.status(errorToStatus(err)).json({ error: (err as Error).message });
  }
});
