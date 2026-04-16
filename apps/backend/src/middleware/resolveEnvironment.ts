import { Request, Response, NextFunction } from "express";
import { prisma } from "../db/client";

/**
 * Middleware: resolves :envSlug from the URL to an environment ID.
 *
 * Attaches to the request:
 *   req.environmentId  — the environment's UUID
 *   req.environmentSlug — the slug for convenience
 *
 * Returns 404 if the environment slug is invalid.
 * Returns 403 if the authenticated user doesn't have access to the environment.
 */
export async function resolveEnvironment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const slug = req.params.envSlug;

  if (!slug) {
    res.status(400).json({ error: "Environment slug is required" });
    return;
  }

  const organizationId = (req as any).organizationId as string | null;

  // Resolve environment scoped to organization when available
  const environment = organizationId
    ? await prisma.environment.findUnique({
        where: { organizationId_slug: { organizationId, slug } },
      })
    : await prisma.environment.findFirst({ where: { slug } });

  if (!environment) {
    res.status(404).json({ error: `Environment "${slug}" not found` });
    return;
  }

  // Verify org ownership when organizationId is set
  if (organizationId && environment.organizationId !== organizationId) {
    res.status(403).json({ error: `Environment "${slug}" does not belong to your organization` });
    return;
  }

  // Check user access — master API tokens (userId=null) have access to all environments
  const userId = (req as any).userId as string | null;
  if (userId) {
    const membership = await prisma.userEnvironment.findUnique({
      where: { userId_environmentId: { userId, environmentId: environment.id } },
    });
    if (!membership) {
      res.status(403).json({ error: `You do not have access to the "${slug}" environment` });
      return;
    }
    (req as any).envRole = membership.role;
  } else {
    // Master token / API token — full access
    (req as any).envRole = "admin";
  }

  (req as any).environmentId = environment.id;
  (req as any).environmentSlug = environment.slug;
  next();
}
