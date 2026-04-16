import { Router, Request, Response } from "express";
import { environmentService } from "../services/EnvironmentService";
import { logger } from "../logger";

// =============================================================================
// Environment routes — CRUD for environments + membership management
// All routes are protected (requireAuth applied before mounting)
// =============================================================================

export const environmentRouter: import("express").Router = Router();

function errStatus(err: unknown) {
  const code = (err as any)?.code;
  if (code === "NOT_FOUND") return 404;
  if (code === "VALIDATION_ERROR") return 422;
  if (code === "CONFLICT") return 409;
  return 500;
}

// GET /api/environments — list environments the current user has access to
environmentRouter.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | null;
    const userRole = (req as any).userRole as string;
    const organizationId = (req as any).organizationId as string | null;
    // Admins or API tokens see all environments; regular users see only their own
    const envs = userRole === "admin"
      ? await environmentService.listEnvironments(undefined, organizationId ?? undefined)
      : await environmentService.listEnvironments(userId ?? undefined, organizationId ?? undefined);
    res.json(envs);
  } catch (err) {
    logger.error("GET /environments error", { err });
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/environments — create a new environment (admin only)
environmentRouter.post("/", async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).userRole as string;
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Only admins can create environments" });
    }

    const { name, slug } = req.body as { name: string; slug: string };
    if (!name || !slug) return res.status(400).json({ error: "name and slug are required" });

    const organizationId = (req as any).organizationId as string | null;
    if (!organizationId) {
      return res.status(400).json({ error: "Organization context is required to create an environment" });
    }

    const env = await environmentService.createEnvironment({ name, slug, organizationId });

    // Auto-add the creating user as admin member
    const userId = (req as any).userId as string | null;
    if (userId) {
      await environmentService.addMember(env.id, userId, "admin");
    }

    res.status(201).json(env);
  } catch (err) {
    logger.error("POST /environments error", { err });
    res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});

// PUT /api/environments/:id — update environment name/slug (admin only)
environmentRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).userRole as string;
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Only admins can update environments" });
    }

    const { name, slug } = req.body as { name?: string; slug?: string };
    const env = await environmentService.updateEnvironment(req.params.id, { name, slug });
    res.json(env);
  } catch (err) {
    logger.error("PUT /environments/:id error", { err });
    res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});

// DELETE /api/environments/:id — delete environment (admin only)
environmentRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).userRole as string;
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Only admins can delete environments" });
    }

    await environmentService.deleteEnvironment(req.params.id);
    res.status(204).end();
  } catch (err) {
    logger.error("DELETE /environments/:id error", { err });
    res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// Membership routes
// ---------------------------------------------------------------------------

// GET /api/environments/:id/members
environmentRouter.get("/:id/members", async (req: Request, res: Response) => {
  try {
    const members = await environmentService.listMembers(req.params.id);
    res.json(members);
  } catch (err) {
    logger.error("GET /environments/:id/members error", { err });
    res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});

// POST /api/environments/:id/members — add a user to the environment
environmentRouter.post("/:id/members", async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).userRole as string;
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Only admins can manage environment members" });
    }

    const { userId, role } = req.body as { userId: string; role?: string };
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const member = await environmentService.addMember(req.params.id, userId, role);
    res.status(201).json(member);
  } catch (err) {
    logger.error("POST /environments/:id/members error", { err });
    res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});

// PUT /api/environments/:id/members/:memberId — update member role
environmentRouter.put("/:id/members/:memberId", async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).userRole as string;
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Only admins can manage environment members" });
    }

    const { role } = req.body as { role: string };
    if (!role) return res.status(400).json({ error: "role is required" });

    await environmentService.updateMemberRole(req.params.memberId, role);
    res.status(204).end();
  } catch (err) {
    logger.error("PUT /environments/:id/members/:memberId error", { err });
    res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});

// DELETE /api/environments/:id/members/:memberId — remove a member
environmentRouter.delete("/:id/members/:memberId", async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).userRole as string;
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Only admins can manage environment members" });
    }

    await environmentService.removeMember(req.params.memberId);
    res.status(204).end();
  } catch (err) {
    logger.error("DELETE /environments/:id/members/:memberId error", { err });
    res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});
