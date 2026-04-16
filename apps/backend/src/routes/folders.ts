import { Router, Request, Response } from "express";
import { folderService } from "../services/FolderService";
import { prisma } from "../db/client";
import { logger } from "../logger";

export const folderRouter: Router = Router();

function errStatus(err: unknown) {
  const code = (err as any)?.code;
  if (code === "NOT_FOUND") return 404;
  if (code === "VALIDATION_ERROR") return 422;
  return 500;
}

// GET /api/folders — flat list of all folders
folderRouter.get("/", async (req: Request, res: Response) => {
  try {
    const environmentId = (req as any).environmentId as string;
    res.json(await folderService.listFolders(environmentId));
  } catch (err) {
    logger.error("GET /folders", { err });
    res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});

// POST /api/folders — create folder
folderRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { name, parentId } = req.body as { name: string; parentId?: string };
    const environmentId = (req as any).environmentId as string;
    res.status(201).json(await folderService.createFolder(name, environmentId, parentId));
  } catch (err) {
    logger.error("POST /folders", { err });
    res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});

// PUT /api/folders/:id — rename
folderRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const { name } = req.body as { name: string };
    res.json(await folderService.renameFolder(req.params.id, name));
  } catch (err) {
    logger.error("PUT /folders/:id", { err });
    res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});

// PATCH /api/folders/:id/move — move to different parent
folderRouter.patch("/:id/move", async (req: Request, res: Response) => {
  try {
    const { parentId } = req.body as { parentId: string | null };
    res.json(await folderService.moveFolder(req.params.id, parentId ?? null));
  } catch (err) {
    logger.error("PATCH /folders/:id/move", { err });
    res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});

// DELETE /api/folders/:id — delete folder, move contents to parent
folderRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    await folderService.deleteFolder(req.params.id);
    res.status(204).send();
  } catch (err) {
    logger.error("DELETE /folders/:id", { err });
    res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});

// PATCH /api/folders/:id/workflows/:wfId — move a workflow into this folder
folderRouter.patch("/:id/workflows/:wfId", async (req: Request, res: Response) => {
  try {
    const wf = await prisma.workflow.update({
      where: { id: req.params.wfId },
      data: { folderId: req.params.id === "root" ? null : req.params.id },
    });
    res.json({ id: wf.id, folderId: wf.folderId });
  } catch (err) {
    logger.error("PATCH /folders/:id/workflows/:wfId", { err });
    res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});
