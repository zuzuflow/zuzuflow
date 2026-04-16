import { Router, Request, Response } from "express";
import { settingService } from "../services/SettingService";
import { logger } from "../logger";

export const settingsRouter: Router = Router();

// GET /api/settings — all settings (secrets masked)
settingsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const all = await settingService.getAll();
    // Mask token before sending to client
    if (all.git && typeof all.git === "object") {
      const git = { ...(all.git as any) };
      if (git.token) git.token = "••••••••";
      all.git = git;
    }
    res.json(all);
  } catch (err) {
    logger.error("GET /settings", { err });
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/settings/:key — single setting
settingsRouter.get("/:key", async (req: Request, res: Response) => {
  try {
    const value = await settingService.get(req.params.key);
    if (value === null) return res.status(404).json({ error: "Not found" });
    // Mask token
    if (req.params.key === "git" && typeof value === "object") {
      const masked = { ...(value as any) };
      if (masked.token) masked.token = "••••••••";
      return res.json(masked);
    }
    res.json(value);
  } catch (err) {
    logger.error("GET /settings/:key", { err });
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /api/settings/:key — upsert a setting
settingsRouter.put("/:key", async (req: Request, res: Response) => {
  try {
    await settingService.set(req.params.key, req.body.value);
    res.json({ ok: true });
  } catch (err) {
    logger.error("PUT /settings/:key", { err });
    res.status(500).json({ error: (err as Error).message });
  }
});
