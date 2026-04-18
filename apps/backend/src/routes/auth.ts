import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { logger } from "../logger";
import { userService } from "../services/UserService";
import { apiTokenService } from "../services/ApiTokenService";
import { organizationService } from "../services/OrganizationService";
import { requireAuth } from "../middleware/auth";

export const authRouter: Router = Router();

const JWT_EXPIRY = "8h";

function errStatus(err: unknown) {
  const code = (err as any)?.code;
  if (code === "NOT_FOUND") return 404;
  if (code === "FORBIDDEN") return 403;
  if (code === "VALIDATION_ERROR") return 422;
  if (code === "CONFLICT") return 409;
  return 500;
}

// ---------------------------------------------------------------------------
// POST /api/auth/login  { usernameOrEmail | username, password } → { token, user, organizations? }
// ---------------------------------------------------------------------------
authRouter.post("/login", async (req: Request, res: Response) => {
  const { usernameOrEmail, username, password } = req.body as {
    usernameOrEmail?: string;
    username?: string;
    password?: string;
  };

  const login = usernameOrEmail || username;
  if (!login || !password) {
    return res.status(400).json({ error: "usernameOrEmail (or username) and password are required" });
  }

  const user = await userService.authenticate(login, password, req.ip ?? undefined);
  if (!user) {
    logger.warn("Failed login attempt", { login, ip: req.ip });
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Look up user's organizations
  let orgs = await organizationService.listUserOrganizations(user.id);

  // If zero orgs (shouldn't happen), create a personal one
  if (orgs.length === 0) {
    const newOrg = await organizationService.createOrgWithOwner(`${user.username}'s Organization`, user.id);
    orgs = [newOrg];
  }

  if (orgs.length === 1) {
    // Single org — include orgId in JWT
    const membership = await organizationService.getOrgMembership(user.id, orgs[0].id);
    const token = jwt.sign(
      { sub: user.id, username: user.username, role: membership?.role ?? user.role, orgId: orgs[0].id },
      config.JWT_SECRET,
      { expiresIn: JWT_EXPIRY },
    );
    logger.info("Login successful (single org)", { userId: user.id, orgId: orgs[0].id, ip: req.ip });
    return res.json({ token, expiresIn: JWT_EXPIRY, user, organization: orgs[0] });
  }

  // Multiple orgs — return token without orgId, let client pick
  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    config.JWT_SECRET,
    { expiresIn: JWT_EXPIRY },
  );
  logger.info("Login successful (multi-org)", { userId: user.id, orgCount: orgs.length, ip: req.ip });
  return res.json({ token, expiresIn: JWT_EXPIRY, user, organizations: orgs });
});

// ---------------------------------------------------------------------------
// POST /api/auth/refresh  — renew JWT (requires valid JWT)
// ---------------------------------------------------------------------------
authRouter.post("/refresh", requireAuth, (req: Request, res: Response) => {
  // requireAuth already verified the token; re-issue a fresh one
  const authHeader = req.headers["authorization"] as string;
  const raw = authHeader.slice(7); // strip "Bearer "
  try {
    const decoded = jwt.verify(raw, config.JWT_SECRET) as { sub: string; username: string; role: string; orgId?: string };
    const payload: Record<string, unknown> = { sub: decoded.sub, username: decoded.username, role: decoded.role };
    if (decoded.orgId) payload.orgId = decoded.orgId;
    const token = jwt.sign(payload, config.JWT_SECRET, { expiresIn: JWT_EXPIRY });
    return res.json({ token, expiresIn: JWT_EXPIRY });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/signup  { username, email, password } → { token, user, organization }
// ---------------------------------------------------------------------------
authRouter.post("/signup", async (req: Request, res: Response) => {
  if (!config.SIGNUP_ENABLED) {
    return res.status(403).json({ error: "Signup is disabled" });
  }

  const { username, email, password } = req.body as { username?: string; email?: string; password?: string };
  if (!username || !email || !password) {
    return res.status(400).json({ error: "username, email, and password are required" });
  }

  try {
    const { user, organizationId } = await userService.signup(username, email, password);
    const org = await organizationService.listUserOrganizations(user.id);
    const organization = org.find((o) => o.id === organizationId) ?? org[0];

    const token = jwt.sign(
      { sub: user.id, username: user.username, role: "owner", orgId: organizationId },
      config.JWT_SECRET,
      { expiresIn: JWT_EXPIRY },
    );

    logger.info("Signup successful", { userId: user.id, username: user.username, orgId: organizationId });
    return res.status(201).json({ token, expiresIn: JWT_EXPIRY, user, organization });
  } catch (err) {
    return res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/organizations — list current user's organizations
// ---------------------------------------------------------------------------
authRouter.get("/organizations", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    if (!userId) {
      return res.status(400).json({ error: "JWT-authenticated user required" });
    }
    const orgs = await organizationService.listUserOrganizations(userId);
    return res.json(orgs);
  } catch (err) {
    return res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/switch-org  { organizationId } → { token }
// ---------------------------------------------------------------------------
authRouter.post("/switch-org", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    if (!userId) {
      return res.status(400).json({ error: "JWT-authenticated user required" });
    }

    const { organizationId } = req.body as { organizationId?: string };
    if (!organizationId) {
      return res.status(400).json({ error: "organizationId is required" });
    }

    // Verify the user is a member of the target org
    const membership = await organizationService.getOrgMembership(userId, organizationId);
    if (!membership) {
      return res.status(403).json({ error: "You are not a member of this organization" });
    }

    // Decode existing token to get username
    const authHeader = req.headers["authorization"] as string;
    const raw = authHeader.slice(7);
    const decoded = jwt.verify(raw, config.JWT_SECRET) as { sub: string; username: string };

    const token = jwt.sign(
      { sub: decoded.sub, username: decoded.username, role: membership.role, orgId: organizationId },
      config.JWT_SECRET,
      { expiresIn: JWT_EXPIRY },
    );

    logger.info("Org switch", { userId, organizationId });
    return res.json({ token, expiresIn: JWT_EXPIRY });
  } catch (err) {
    return res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// User management (admin only in a real app — simplified here)
// ---------------------------------------------------------------------------

// GET /api/auth/users
authRouter.get("/users", requireAuth, async (_req, res) => {
  try {
    res.json(await userService.listUsers());
  } catch (err) { res.status(errStatus(err)).json({ error: (err as Error).message }); }
});

// POST /api/auth/users  { username, email, password, role? }
authRouter.post("/users", requireAuth, async (req: Request, res: Response) => {
  try {
    const { username, email, password, role } = req.body as { username: string; email: string; password: string; role?: "admin" | "editor" };
    const user = await userService.createUser(username, email, password, role);
    res.status(201).json(user);
  } catch (err) { res.status(errStatus(err)).json({ error: (err as Error).message }); }
});

// PUT /api/auth/users/:id/password  { password }
authRouter.put("/users/:id/password", requireAuth, async (req: Request, res: Response) => {
  try {
    const { password } = req.body as { password: string };
    await userService.changePassword(req.params.id, password);
    res.status(204).send();
  } catch (err) { res.status(errStatus(err)).json({ error: (err as Error).message }); }
});

// DELETE /api/auth/users/:id
authRouter.delete("/users/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const actorId = (req as any).userId as string;
    const actorRole = (req as any).userRole as string;
    await userService.deleteUser(req.params.id, { id: actorId, role: actorRole });
    res.status(204).send();
  } catch (err) { res.status(errStatus(err)).json({ error: (err as Error).message }); }
});

// ---------------------------------------------------------------------------
// Organization management
// ---------------------------------------------------------------------------

// GET /api/auth/organization — get current org details
authRouter.get("/organization", requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).organizationId as string | undefined;
    if (!orgId) return res.status(400).json({ error: "No organization context" });
    const org = await organizationService.getOrganization(orgId);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    return res.json(org);
  } catch (err) { res.status(errStatus(err)).json({ error: (err as Error).message }); }
});

// PUT /api/auth/organization — update current org details (admin/owner only)
authRouter.put("/organization", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const orgId = (req as any).organizationId as string | undefined;
    if (!orgId) return res.status(400).json({ error: "No organization context" });

    // Check user is owner or admin of this org
    const membership = await organizationService.getOrgMembership(userId, orgId);
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      return res.status(403).json({ error: "Only org owners or admins can update organization details" });
    }

    const { name, address } = req.body as { name?: string; address?: string };
    const updated = await organizationService.updateOrganization(orgId, { name, address });
    return res.json(updated);
  } catch (err) { res.status(errStatus(err)).json({ error: (err as Error).message }); }
});

// ---------------------------------------------------------------------------
// API Token management
// ---------------------------------------------------------------------------

// GET /api/auth/tokens — list tokens for the logged-in user
authRouter.get("/tokens", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    res.json(await apiTokenService.listTokens(userId));
  } catch (err) { res.status(errStatus(err)).json({ error: (err as Error).message }); }
});

// POST /api/auth/tokens  { name } — create token
authRouter.post("/tokens", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { name } = req.body as { name: string };
    const result = await apiTokenService.createToken(userId, name);
    res.status(201).json(result); // raw token included ONCE
  } catch (err) { res.status(errStatus(err)).json({ error: (err as Error).message }); }
});

// DELETE /api/auth/tokens/:id — revoke
authRouter.delete("/tokens/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    await apiTokenService.revokeToken(req.params.id, userId);
    res.status(204).send();
  } catch (err) { res.status(errStatus(err)).json({ error: (err as Error).message }); }
});
