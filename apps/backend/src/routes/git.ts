import { Router, Request, Response } from "express";
import { gitService } from "../services/GitService";
import { logger } from "../logger";

export const gitRouter: Router = Router();

// GET /api/git/status
gitRouter.get("/status", async (_req: Request, res: Response) => {
  try {
    res.json(await gitService.getStatus());
  } catch (err) {
    logger.error("GET /git/status", { err });
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/git/config
gitRouter.get("/config", async (_req: Request, res: Response) => {
  try {
    const cfg = await gitService.getConfig();
    if (!cfg) return res.json(null);
    // Mask token
    res.json({ ...cfg, token: cfg.token ? "••••••••" : "" });
  } catch (err) {
    logger.error("GET /git/config", { err });
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /api/git/config
gitRouter.put("/config", async (req: Request, res: Response) => {
  try {
    const { provider, repoUrl, branch, username, token, autoPush, autoPull, skipVerify } = req.body;
    if (!repoUrl || !branch || !token) {
      return res.status(400).json({ error: "repoUrl, branch, and token are required" });
    }
    // If token is the mask, preserve existing token
    let resolvedToken = token;
    if (token === "••••••••") {
      const existing = await gitService.getConfig();
      resolvedToken = existing?.token ?? "";
    }

    const candidate = {
      provider: provider ?? "github",
      repoUrl,
      branch,
      username,
      token: resolvedToken,
      autoPush: !!autoPush,
      autoPull: !!autoPull,
    };

    // Verify credentials BEFORE persisting — we don't want to store a broken
    // config. Callers that only want to flip autoPush/autoPull on an already
    // verified config can pass `skipVerify: true`.
    let verifyResult: { writeConfirmed: boolean; message: string } | null = null;
    if (!skipVerify) {
      try {
        const r = await gitService.verifyAccess(candidate);
        verifyResult = { writeConfirmed: r.writeConfirmed, message: r.message };
      } catch (err) {
        const code = (err as any)?.code;
        const status = code === "AUTH_FAILED" || code === "NO_WRITE_ACCESS" ? 403
          : code === "REPO_NOT_FOUND" ? 404
          : code === "CONNECT_FAILED" ? 502
          : 400;
        logger.warn("Git config verification failed", { code, err });
        return res.status(status).json({ error: (err as Error).message, code });
      }
    }

    await gitService.saveConfig(candidate);
    res.json({ ok: true, verify: verifyResult });
  } catch (err) {
    logger.error("PUT /git/config", { err });
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/git/push
gitRouter.post("/push", async (_req: Request, res: Response) => {
  try {
    const result = await gitService.push();
    res.json(result);
  } catch (err) {
    logger.error("POST /git/push", { err });
    const code = (err as any)?.code;
    res.status(code === "NOT_CONFIGURED" ? 400 : 500).json({ error: (err as Error).message });
  }
});

// POST /api/git/pull
gitRouter.post("/pull", async (_req: Request, res: Response) => {
  try {
    const result = await gitService.pull();
    res.json(result);
  } catch (err) {
    logger.error("POST /git/pull", { err });
    const code = (err as any)?.code;
    res.status(code === "NOT_CONFIGURED" ? 400 : 500).json({ error: (err as Error).message });
  }
});
