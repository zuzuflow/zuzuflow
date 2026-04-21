import { Router, Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { logger } from "../logger";
import { userService } from "../services/UserService";
import { apiTokenService } from "../services/ApiTokenService";
import { organizationService } from "../services/OrganizationService";
import { mfaService } from "../services/MfaService";
import { inviteService } from "../services/InviteService";
import { emailService } from "../services/EmailService";
import { orgSettingsService } from "../services/OrgSettingsService";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../db/client";

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
    return res.status(400).json({
      error: "usernameOrEmail (or username) and password are required",
    });
  }

  const user = await userService.authenticate(
    login,
    password,
    req.ip ?? undefined,
  );
  if (!user) {
    logger.warn("Failed login attempt", { login, ip: req.ip });
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Look up user's organizations
  let orgs = await organizationService.listUserOrganizations(user.id);

  // If zero orgs (shouldn't happen), create a personal one
  if (orgs.length === 0) {
    const newOrg = await organizationService.createOrgWithOwner(
      `${user.username}'s Organization`,
      user.id,
    );
    orgs = [newOrg];
  }

  // Check if MFA is required
  const mfaStatus = await mfaService.getMfaStatus(user.id);
  const enrolled = mfaService.isUserEnrolledByStatus(mfaStatus);

  // Org-level enforcement: for single-org users, issue enrollment-only token
  // until at least one MFA method is enrolled.
  if (orgs.length === 1 && orgs[0].mfaEnforced && !enrolled) {
    const membership = await organizationService.getOrgMembership(
      user.id,
      orgs[0].id,
    );
    const token = jwt.sign(
      {
        sub: user.id,
        username: user.username,
        role: membership?.role ?? user.role,
        orgId: orgs[0].id,
        mfaEnrollmentOnly: true,
      },
      config.JWT_SECRET,
      { expiresIn: JWT_EXPIRY },
    );

    logger.info("MFA enrollment required by organization policy", {
      userId: user.id,
      orgId: orgs[0].id,
      ip: req.ip,
    });
    return res.status(200).json({
      mfaEnrollmentRequired: true,
      token,
      expiresIn: JWT_EXPIRY,
      user,
      organization: orgs[0],
      message:
        "Your organization requires MFA. Complete enrollment to continue.",
    });
  }

  if (mfaStatus.totpEnabled || mfaStatus.emailEnabled) {
    const challengeToken = await mfaService.createLoginChallenge(user.id);

    // If email OTP is enabled (and TOTP is not, or as fallback), send the OTP
    let emailChallengeId: string | undefined;
    if (mfaStatus.emailEnabled) {
      emailChallengeId = await mfaService.sendEmailOtp(user.id, user.email);
    }

    logger.info("MFA challenge issued", {
      userId: user.id,
      totpEnabled: mfaStatus.totpEnabled,
      emailEnabled: mfaStatus.emailEnabled,
    });
    return res.status(200).json({
      mfaRequired: true,
      challengeToken,
      emailChallengeId,
      mfaMethods: {
        totp: mfaStatus.totpEnabled,
        email: mfaStatus.emailEnabled,
      },
    });
  }

  if (orgs.length === 1) {
    // Single org — include orgId in JWT.
    // System-level roles (superadmin/admin) always win over org-level membership
    // roles.
    const membership = await organizationService.getOrgMembership(
      user.id,
      orgs[0].id,
    );
    const systemRole = user.role;
    const effectiveRole =
      systemRole === "superadmin" || systemRole === "admin"
        ? systemRole
        : (membership?.role ?? systemRole);
    const token = jwt.sign(
      {
        sub: user.id,
        username: user.username,
        role: effectiveRole,
        orgId: orgs[0].id,
      },
      config.JWT_SECRET,
      { expiresIn: JWT_EXPIRY },
    );
    logger.info("Login successful (single org)", {
      userId: user.id,
      orgId: orgs[0].id,
      role: effectiveRole,
      ip: req.ip,
    });
    return res.json({
      token,
      expiresIn: JWT_EXPIRY,
      user,
      organization: orgs[0],
    });
  }

  // Multiple orgs — return token without orgId, let client pick
  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    config.JWT_SECRET,
    { expiresIn: JWT_EXPIRY },
  );
  logger.info("Login successful (multi-org)", {
    userId: user.id,
    orgCount: orgs.length,
    ip: req.ip,
  });
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
    const decoded = jwt.verify(raw, config.JWT_SECRET) as {
      sub: string;
      username: string;
      role: string;
      orgId?: string;
    };
    const payload: Record<string, unknown> = {
      sub: decoded.sub,
      username: decoded.username,
      role: decoded.role,
    };
    if (decoded.orgId) payload.orgId = decoded.orgId;
    const token = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
    });
    return res.json({ token, expiresIn: JWT_EXPIRY });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// GET /api/auth/signup-status — unauth public probe.
//
// Frontend uses this on the Login + Signup pages to decide whether to show
// the "Sign up" link / form. Kept separate from /signup so the check itself
// never incurs a DB write.
// ---------------------------------------------------------------------------
authRouter.get("/signup-status", (_req: Request, res: Response) => {
  res.json({ enabled: !!config.SIGNUP_ENABLED });
});

// ---------------------------------------------------------------------------
// GET /api/auth/invites/public/:token — unauth public invite preview
//
// Used by the /invite/:token landing page to render "Alice invited you to Acme"
// before the user has logged in. Returns ONLY non-sensitive fields; the actual
// accept still requires authentication.
// ---------------------------------------------------------------------------
authRouter.get(
  "/invites/public/:token",
  async (req: Request, res: Response) => {
    try {
      const preview = await inviteService.getPublicInvite(req.params.token);
      res.json(preview);
    } catch (err) {
      const code = (err as any)?.code;
      const status =
        code === "EXPIRED" ? 410 : code === "NOT_FOUND" ? 404 : 500;
      res.status(status).json({ error: (err as Error).message });
    }
  },
);

// POST /api/auth/signup  { username, email, password } → { token, user, organization }
// ---------------------------------------------------------------------------
authRouter.post("/signup", async (req: Request, res: Response) => {
  const { username, email, password, inviteToken } = req.body as {
    username?: string;
    email?: string;
    password?: string;
    inviteToken?: string;
  };

  // Public signup gate. An invite token bypasses this — invites are an
  // admin-driven path, not public. We validate the token here (before touching
  // any user record) so a bogus token can't be used to sneak past the gate.
  if (!config.SIGNUP_ENABLED) {
    if (!inviteToken) {
      return res.status(403).json({ error: "Signup is disabled" });
    }
    try {
      await inviteService.resolveInvite(inviteToken);
    } catch {
      return res.status(403).json({
        error:
          "Signup is disabled. A valid invite is required to create an account on this instance.",
      });
    }
  }

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: "username, email, and password are required" });
  }

  try {
    const { user, organizationId } = await userService.signup(
      username,
      email,
      password,
    );

    // If signup was triggered from an invite email, auto-accept it so the user
    // lands directly inside the inviting org (and isn't stuck with only the
    // personal org their signup created).
    let activeOrgId = organizationId;
    if (inviteToken) {
      try {
        const result = await inviteService.acceptInvite(inviteToken, user.id);
        activeOrgId = result.organizationId;
        logger.info("Signup auto-accepted invite", {
          userId: user.id,
          invitedOrgId: activeOrgId,
        });
      } catch (err) {
        // Non-fatal — user account still created; they can accept manually.
        logger.warn("Signup invite auto-accept failed", {
          userId: user.id,
          err: (err as Error).message,
        });
      }
    }

    const org = await organizationService.listUserOrganizations(user.id);
    const organization = org.find((o) => o.id === activeOrgId) ?? org[0];

    // The very first signup is a superadmin (see UserService.signup). Reflect
    // that in the JWT; otherwise fall back to "owner" for the new org they just
    // created.
    const effectiveRole =
      user.role === "superadmin" || user.role === "admin" ? user.role : "owner";
    const token = jwt.sign(
      {
        sub: user.id,
        username: user.username,
        role: effectiveRole,
        orgId: activeOrgId,
      },
      config.JWT_SECRET,
      { expiresIn: JWT_EXPIRY },
    );

    logger.info("Signup successful", {
      userId: user.id,
      username: user.username,
      orgId: activeOrgId,
    });
    return res
      .status(201)
      .json({ token, expiresIn: JWT_EXPIRY, user, organization });
  } catch (err) {
    return res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/organizations — list current user's organizations
// ---------------------------------------------------------------------------
authRouter.get(
  "/organizations",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      if (!userId) {
        return res
          .status(400)
          .json({ error: "JWT-authenticated user required" });
      }
      const orgs = await organizationService.listUserOrganizations(userId);
      return res.json(orgs);
    } catch (err) {
      return res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/auth/switch-org  { organizationId } → { token }
// ---------------------------------------------------------------------------
authRouter.post(
  "/switch-org",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      if (!userId) {
        return res
          .status(400)
          .json({ error: "JWT-authenticated user required" });
      }

      const { organizationId } = req.body as { organizationId?: string };
      if (!organizationId) {
        return res.status(400).json({ error: "organizationId is required" });
      }

      // Verify the user is a member of the target org
      const membership = await organizationService.getOrgMembership(
        userId,
        organizationId,
      );
      if (!membership) {
        return res
          .status(403)
          .json({ error: "You are not a member of this organization" });
      }

      // Decode existing token to get username
      const authHeader = req.headers["authorization"] as string;
      const raw = authHeader.slice(7);
      const decoded = jwt.verify(raw, config.JWT_SECRET) as {
        sub: string;
        username: string;
      };

      const fullUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      const systemRole = fullUser?.role ?? "editor";
      const effectiveRole =
        systemRole === "superadmin" || systemRole === "admin"
          ? systemRole
          : membership.role;

      const mfaStatus = await mfaService.getMfaStatus(userId);
      const enrolled = mfaService.isUserEnrolledByStatus(mfaStatus);
      const targetOrg =
        await organizationService.getOrganization(organizationId);

      if (targetOrg?.mfaEnforced && !enrolled) {
        const enrollmentToken = jwt.sign(
          {
            sub: decoded.sub,
            username: decoded.username,
            role: effectiveRole,
            orgId: organizationId,
            mfaEnrollmentOnly: true,
          },
          config.JWT_SECRET,
          { expiresIn: JWT_EXPIRY },
        );

        logger.info("Org switch blocked pending MFA enrollment", {
          userId,
          organizationId,
        });
        return res.status(200).json({
          mfaEnrollmentRequired: true,
          token: enrollmentToken,
          expiresIn: JWT_EXPIRY,
          organization: {
            id: targetOrg.id,
            name: targetOrg.name,
            slug: targetOrg.slug,
            role: effectiveRole,
            mfaEnforced: targetOrg.mfaEnforced,
          },
          message:
            "This organization requires MFA. Complete enrollment to continue.",
        });
      }

      const token = jwt.sign(
        {
          sub: decoded.sub,
          username: decoded.username,
          role: effectiveRole,
          orgId: organizationId,
        },
        config.JWT_SECRET,
        { expiresIn: JWT_EXPIRY },
      );

      logger.info("Org switch", {
        userId,
        organizationId,
        role: effectiveRole,
      });
      return res.json({ token, expiresIn: JWT_EXPIRY });
    } catch (err) {
      return res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// ---------------------------------------------------------------------------
// User management (admin only in a real app — simplified here)
// ---------------------------------------------------------------------------

// GET /api/auth/users
// GET /api/auth/users — system-wide user list. Restricted to superadmin; the
// Settings → Users tab uses /auth/organization/members instead for org scoping.
authRouter.get("/users", requireAuth, async (req, res) => {
  try {
    const userRole = (req as any).userRole as string;
    if (userRole !== "superadmin") {
      return res.status(403).json({
        error: "Use GET /auth/organization/members for org-scoped user listing",
      });
    }
    res.json(await userService.listUsers());
  } catch (err) {
    res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});

// POST /api/auth/users  { username, email, password, role? }
authRouter.post("/users", requireAuth, async (req: Request, res: Response) => {
  try {
    const { username, email, password, role } = req.body as {
      username: string;
      email: string;
      password: string;
      role?: "admin" | "editor";
    };
    const user = await userService.createUser(username, email, password, role);
    res.status(201).json(user);
  } catch (err) {
    res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});

// PUT /api/auth/users/:id/password  { password }
authRouter.put(
  "/users/:id/password",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { password } = req.body as { password: string };
      await userService.changePassword(req.params.id, password);
      res.status(204).send();
    } catch (err) {
      res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// DELETE /api/auth/users/:id
authRouter.delete(
  "/users/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const actorId = (req as any).userId as string;
      const actorRole = (req as any).userRole as string;
      await userService.deleteUser(req.params.id, {
        id: actorId,
        role: actorRole,
      });
      res.status(204).send();
    } catch (err) {
      res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// ---------------------------------------------------------------------------
// Org-scoped member list + invite flow
// ---------------------------------------------------------------------------

/** Require the caller to be owner/admin/superadmin of their current org. */
async function requireOrgAdmin(
  userId: string,
  userRole: string,
  orgId: string,
): Promise<void> {
  // System superadmin always passes.
  if (userRole === "superadmin" || userRole === "admin") return;
  const membership = await organizationService.getOrgMembership(userId, orgId);
  if (
    !membership ||
    (membership.role !== "owner" && membership.role !== "admin")
  ) {
    throw Object.assign(
      new Error("Only organization owners or admins can perform this action"),
      { code: "FORBIDDEN" },
    );
  }
}

// GET /api/auth/organization/members — list current org's members
authRouter.get(
  "/organization/members",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).organizationId as string | undefined;
      if (!orgId)
        return res.status(400).json({ error: "No organization context" });
      const members = await organizationService.listOrgMembers(orgId);
      res.json(members);
    } catch (err) {
      res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// PUT /api/auth/organization/members/:userId/role  { role }
authRouter.put(
  "/organization/members/:userId/role",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const actorId = (req as any).userId as string;
      const actorRole = (req as any).userRole as string;
      const orgId = (req as any).organizationId as string | undefined;
      if (!orgId)
        return res.status(400).json({ error: "No organization context" });
      await requireOrgAdmin(actorId, actorRole, orgId);

      const { role } = req.body as { role?: "admin" | "member" | "owner" };
      if (role !== "admin" && role !== "member" && role !== "owner") {
        return res
          .status(400)
          .json({ error: "role must be admin, member, or owner" });
      }
      await organizationService.updateMemberRole(
        orgId,
        req.params.userId,
        role,
      );
      res.status(204).send();
    } catch (err) {
      res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// DELETE /api/auth/organization/members/:userId — remove a member
authRouter.delete(
  "/organization/members/:userId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const actorId = (req as any).userId as string;
      const actorRole = (req as any).userRole as string;
      const orgId = (req as any).organizationId as string | undefined;
      if (!orgId)
        return res.status(400).json({ error: "No organization context" });
      await requireOrgAdmin(actorId, actorRole, orgId);
      if (req.params.userId === actorId) {
        return res
          .status(400)
          .json({ error: "You cannot remove yourself from the organization" });
      }
      await organizationService.removeMemberFromOrg(orgId, req.params.userId);
      res.status(204).send();
    } catch (err) {
      res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// POST /api/auth/organization/invites  { email, role }
authRouter.post(
  "/organization/invites",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const actorId = (req as any).userId as string;
      const actorRole = (req as any).userRole as string;
      const orgId = (req as any).organizationId as string | undefined;
      if (!orgId)
        return res.status(400).json({ error: "No organization context" });
      await requireOrgAdmin(actorId, actorRole, orgId);

      const { email, role } = req.body as {
        email?: string;
        role?: "admin" | "member";
      };
      if (!email) return res.status(400).json({ error: "email is required" });
      const finalRole = role === "admin" ? "admin" : "member";

      const { invite, rawToken, acceptUrl, targetUserExists } =
        await inviteService.createInvite(orgId, email, finalRole, actorId);

      // Fire-and-forget email — don't block the API response on SMTP.
      const inviterName =
        (
          await prisma.user.findUnique({
            where: { id: actorId },
            select: { username: true },
          })
        )?.username ?? "Someone";
      const orgName = invite.organizationName;
      void emailService.sendOrgInvite({
        to: invite.invitedEmail,
        orgName,
        inviterName,
        acceptUrl,
        role: finalRole,
        isExistingUser: targetUserExists,
      });

      res.status(201).json({ invite, acceptUrl, targetUserExists, rawToken });
    } catch (err) {
      res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// GET /api/auth/organization/invites — pending invites for the current org
authRouter.get(
  "/organization/invites",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).organizationId as string | undefined;
      if (!orgId)
        return res.status(400).json({ error: "No organization context" });
      const invites = await inviteService.listPendingForOrg(orgId);
      res.json(invites);
    } catch (err) {
      res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// DELETE /api/auth/organization/invites/:id — revoke a pending invite
authRouter.delete(
  "/organization/invites/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const actorId = (req as any).userId as string;
      const actorRole = (req as any).userRole as string;
      const orgId = (req as any).organizationId as string | undefined;
      if (!orgId)
        return res.status(400).json({ error: "No organization context" });
      await requireOrgAdmin(actorId, actorRole, orgId);
      await inviteService.revokeInvite(req.params.id, [orgId]);
      res.status(204).send();
    } catch (err) {
      res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// GET /api/auth/invites/mine — pending invites addressed to the logged-in user
authRouter.get(
  "/invites/mine",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (!user) return res.status(404).json({ error: "User not found" });
      const invites = await inviteService.listPendingForEmail(user.email);
      res.json(invites);
    } catch (err) {
      res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// POST /api/auth/invites/:token/accept
authRouter.post(
  "/invites/:token/accept",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const result = await inviteService.acceptInvite(req.params.token, userId);
      res.json(result);
    } catch (err) {
      res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// POST /api/auth/invites/:token/decline
authRouter.post(
  "/invites/:token/decline",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      await inviteService.declineInvite(req.params.token, userId);
      res.status(204).send();
    } catch (err) {
      res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// POST /api/auth/invites/by-id/:id/accept — in-app accept (no raw token required)
authRouter.post(
  "/invites/by-id/:id/accept",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const result = await inviteService.acceptInviteById(
        req.params.id,
        userId,
      );
      res.json(result);
    } catch (err) {
      res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// POST /api/auth/invites/by-id/:id/decline
authRouter.post(
  "/invites/by-id/:id/decline",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      await inviteService.declineInviteById(req.params.id, userId);
      res.status(204).send();
    } catch (err) {
      res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// ---------------------------------------------------------------------------
// Organization management
// ---------------------------------------------------------------------------

// GET /api/auth/organization — get current org details
authRouter.get(
  "/organization",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).organizationId as string | undefined;
      if (!orgId)
        return res.status(400).json({ error: "No organization context" });
      const org = await organizationService.getOrganization(orgId);
      if (!org)
        return res.status(404).json({ error: "Organization not found" });
      return res.json(org);
    } catch (err) {
      res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// PUT /api/auth/organization — update current org details (admin/owner only)
authRouter.put(
  "/organization",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const orgId = (req as any).organizationId as string | undefined;
      if (!orgId)
        return res.status(400).json({ error: "No organization context" });

      // Check user is owner or admin of this org
      const membership = await organizationService.getOrgMembership(
        userId,
        orgId,
      );
      if (
        !membership ||
        (membership.role !== "owner" && membership.role !== "admin")
      ) {
        return res.status(403).json({
          error: "Only org owners or admins can update organization details",
        });
      }

      const { name, address, mfaEnforced } = req.body as {
        name?: string;
        address?: string;
        mfaEnforced?: boolean;
      };
      const updated = await organizationService.updateOrganization(orgId, {
        name,
        address,
        mfaEnforced,
      });
      return res.json(updated);
    } catch (err) {
      res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/auth/organization/ai-settings — read AI builder config
// ---------------------------------------------------------------------------
authRouter.get(
  "/organization/ai-settings",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).organizationId as string | undefined;
      if (!orgId)
        return res.status(400).json({ error: "No organization context" });
      const settings = await orgSettingsService.getAiSettings(orgId);
      return res.json(settings);
    } catch (err) {
      res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /api/auth/organization/ai-settings — update AI builder config (admin+)
// ---------------------------------------------------------------------------
authRouter.put(
  "/organization/ai-settings",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const userRole = (req as any).userRole as string;
      const orgId = (req as any).organizationId as string | undefined;
      if (!orgId)
        return res.status(400).json({ error: "No organization context" });
      await requireOrgAdmin(userId, userRole, orgId);

      const { aiBuilderEnabled, aiProvider, aiApiKey, aiModel } = req.body as {
        aiBuilderEnabled?: boolean;
        aiProvider?: string | null;
        aiApiKey?: string | null;
        aiModel?: string | null;
      };
      const updated = await orgSettingsService.updateAiSettings(orgId, {
        aiBuilderEnabled,
        aiProvider,
        aiApiKey,
        aiModel,
      });
      return res.json(updated);
    } catch (err) {
      res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/auth/organization/ai-generate-workflow — generate workflow via LLM
// ---------------------------------------------------------------------------
authRouter.post(
  "/organization/ai-generate-workflow",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).organizationId as string | undefined;
      if (!orgId)
        return res.status(400).json({ error: "No organization context" });

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

      const { prompt, mode, existingTemplate } = req.body as {
        prompt?: string;
        mode?: "new" | "update" | "new_with_existing";
        existingTemplate?: any;
      };
      if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: "prompt is required" });
      }

      const apiKey = await orgSettingsService.getDecryptedApiKey(orgId);
      if (!apiKey) {
        return res.status(400).json({ error: "API key not found" });
      }

      const systemPrompt = buildWorkflowSystemPrompt();
      const buildMode = mode ?? "new";
      const userPrompt = buildUserPrompt(
        prompt.trim(),
        buildMode,
        existingTemplate,
      );
      const result = await callLlmForWorkflow(
        settings.aiProvider,
        settings.aiModel ?? "gpt-4o",
        apiKey,
        systemPrompt,
        userPrompt,
      );

      return res.json(result);
    } catch (err) {
      logger.error("AI workflow generation failed", {
        error: (err as Error).message,
      });
      res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// ---------------------------------------------------------------------------
// AI Workflow Generation helpers
// ---------------------------------------------------------------------------

function buildWorkflowSystemPrompt(): string {
  return `You are a workflow automation builder. Given a user's description of what they want to automate, generate a valid workflow template as JSON.

The workflow template must follow this exact structure:
{
  "version": "1.0",
  "nodes": [
    { "id": "<unique-id>", "kind": "<NodeKind>", "label": "<display label>", "config": { ... }, "position": { "x": <number>, "y": <number> } }
  ],
  "edges": [
    { "id": "<unique-id>", "source": "<node-id>", "target": "<node-id>", "sourceHandle": "out", "targetHandle": "in" }
  ]
}

Available NodeKind values and their configs:

TRIGGERS (every workflow needs exactly one):
- "manual": Manual trigger. Config: {}
- "webhook": HTTP webhook trigger. Config: { "path": "/my-hook", "method": "POST", "auth": { "type": "none" } }
- "cron": Scheduled trigger. Config: { "expression": "0 9 * * *" }

LOGICAL:
- "if_else": Conditional branch. Config: { "condition": "{{data.value}} > 10" }. Has handles: "true" and "false" sourceHandles.
- "switch": Multi-branch switch. Config: { "expression": "{{data.status}}", "cases": [{"value": "active", "label": "Active"}] }
- "delay": Wait. Config: { "delayMs": 5000 }
- "loop": Loop over array. Config: { "arrayExpression": "{{data.items}}" }
- "merge": Merge branches. Config: { "mode": "wait_all" }
- "stop": Stop execution. Config: {}

UTILITIES:
- "http_request": Make HTTP calls. Config: { "url": "https://api.example.com/data", "method": "GET", "headers": {}, "body": "" }
- "data_mapper": Transform data. Config: { "mappings": [{ "from": "{{data.name}}", "to": "fullName" }] }
- "json_parser": Parse JSON. Config: { "expression": "{{data.body}}" }
- "response": Return response. Config: { "statusCode": 200, "body": "{{data.result}}" }

DATA & STORAGE:
- "postgres_query": PostgreSQL query. Config: { "credentialId": "", "query": "SELECT * FROM users" }
- "mysql": MySQL query. Config: { "credentialId": "", "query": "SELECT 1" }
- "mongodb": MongoDB operation. Config: { "credentialId": "", "operation": "find", "collection": "users", "query": "{}" }
- "redis": Redis command. Config: { "credentialId": "", "command": "GET", "args": ["key"] }
- "google_sheets": Google Sheets. Config: { "credentialId": "", "spreadsheetId": "", "operation": "read", "range": "Sheet1!A1:D10" }

COMMUNICATION:
- "send_email": Send email via SMTP. Config: { "credentialId": "", "to": "", "subject": "", "body": "" }
- "slack": Slack message. Config: { "credentialId": "", "channel": "", "message": "" }

AI:
- "llm_prompt": LLM completion. Config: { "provider": "openai", "model": "gpt-4o", "credentialId": "", "systemPrompt": "", "userPrompt": "", "maxTokens": 1000 }
- "ai_agent": AI agent with tools. Config: { "provider": "openai", "model": "gpt-4o", "credentialId": "", "systemPrompt": "", "userPrompt": "", "tools": [], "maxIterations": 5, "maxTokens": 2000 }

CODE:
- "js_runner": Run JavaScript. Config: { "code": "return data;" }

AZURE CLOUD:
- "azure_blob": Azure Blob Storage. Config: { "credentialId": "", "operation": "uploadBlob" | "downloadBlob" | "listBlobs" | "deleteBlob" | "getBlobProperties", "container": "my-container", "blob": "path/to/blob.json", "content": "{{input.body}}", "contentType": "application/json", "prefix": "folder/", "maxResults": 100 }

LAYOUT RULES (enterprise-grade — treat this as non-negotiable):

Pick ONE layout direction and apply it uniformly to EVERY node in the graph.

1. HORIZONTAL (left → right) — DEFAULT for linear or lightly-branching flows.
   - Start at x: 120, y: 240. Horizontal gap BETWEEN COLUMNS: 320px (node box is ~240px wide, leaving ~80px for the edge).
   - Main path: every node shares the same y. Align all y values to multiples of 20.
   - On EVERY node emit:
     "style": { "handlePositions": { "input": "left", "output": "right" } }
   - Branches (if_else, switch, subworkflow_call, or any multi-output custom_builder):
     * The branch node itself sits on the main lane (y=240).
     * Place each branch target in its own lane: y = 240 + laneIndex * 160, where laneIndex ∈ {-1, +1, -2, +2, ...}.
     * When branches reconverge via a "merge" node, put merge back on y=240 after the longest branch finishes.
   - x of node N = 120 + N * 320, using column order from the topological sort.

2. VERTICAL (top → bottom) — use ONLY when there are 4+ parallel branches or a deep decision tree.
   - Start at x: 400, y: 80. Vertical gap: 180px. Horizontal gap between sibling branches: 320px.
   - DO NOT emit handlePositions (top/bottom are the registry defaults — leaving style off is correct).

CONSISTENCY (must hold):
- Every node in the workflow uses the same direction. Never mix.
- x and y values are integers, snapped to multiples of 20.
- No two nodes share the same (x, y).
- No edge crosses through a node box.

IDs: use "<kind>_<n>" starting at 1 per kind — "trigger_1", "http_1", "slack_1", "if_1".

EDGES:
- For linear hops, omit sourceHandle (it defaults to "out").
- For if_else, set sourceHandle to "true" or "false".
- For switch, set sourceHandle to the matching case value.
- For subworkflow_call with multiple outputs, set sourceHandle to "output_0", "output_1", ...
- For a multi-output custom_builder node, set sourceHandle to the output handle id declared on the template.
- Do not set targetHandle — every node has a single implicit input handle.

EXAMPLE (horizontal, 3-node linear flow — copy this shape exactly):
{
  "version": "1.0",
  "nodes": [
    { "id": "trigger_1", "kind": "webhook", "label": "Webhook",
      "config": { "path": "summarize", "method": "POST", "auth": { "type": "none" } },
      "position": { "x": 120, "y": 240 },
      "style": { "handlePositions": { "input": "left", "output": "right" } } },
    { "id": "llm_1", "kind": "llm_prompt", "label": "Summarize",
      "config": { "provider": "gemini", "model": "gemini-2.5-flash-lite",
                  "credentialId": "", "systemPrompt": "", "userPrompt": "{{trigger_1.data.text}}" },
      "position": { "x": 440, "y": 240 },
      "style": { "handlePositions": { "input": "left", "output": "right" } } },
    { "id": "response_1", "kind": "response", "label": "Respond",
      "config": { "statusCode": 200, "body": "{{llm_1.data.result}}" },
      "position": { "x": 760, "y": 240 },
      "style": { "handlePositions": { "input": "left", "output": "right" } } }
  ],
  "edges": [
    { "id": "e_1", "source": "trigger_1", "target": "llm_1" },
    { "id": "e_2", "source": "llm_1", "target": "response_1" }
  ]
}

IMPORTANT:
- Return ONLY valid JSON, no markdown code fences, no explanation text.
- Every workflow MUST start with exactly one trigger node.
- Use "credentialId": "" for nodes that need credentials (user will configure these after).
- Use template expressions like {{nodeId.data.field}} for dynamic data between nodes.
- Every node MUST have a "position" object. Horizontal-mode nodes MUST include the "style.handlePositions" override shown above.`;
}

function buildUserPrompt(
  prompt: string,
  mode: "new" | "update" | "new_with_existing",
  existingTemplate?: any,
): string {
  if (mode === "new" || !existingTemplate) {
    return prompt;
  }

  const existingNodes = (existingTemplate.nodes ?? [])
    .map(
      (n: any) =>
        `  - id: "${n.id}", kind: "${n.kind}", label: "${n.label ?? n.kind}"`,
    )
    .join("\n");
  const existingEdges = (existingTemplate.edges ?? [])
    .map((e: any) => `  - ${e.source} → ${e.target}`)
    .join("\n");

  const templateJson = JSON.stringify(existingTemplate, null, 2);

  if (mode === "update") {
    return `I have an existing workflow that I want to UPDATE/MODIFY. Here is the current workflow:

EXISTING NODES:
${existingNodes}

EXISTING EDGES:
${existingEdges}

FULL EXISTING TEMPLATE:
${templateJson}

USER REQUEST: ${prompt}

IMPORTANT RULES FOR UPDATE MODE:
- Keep ALL existing nodes and edges unless the user explicitly asks to remove them
- Preserve existing node IDs — do NOT rename them
- Add new nodes and edges as requested
- Connect new nodes to existing ones as appropriate
- Preserve existing node positions; place new nodes to the right or below existing ones
- Return the COMPLETE updated template (existing + new nodes/edges)`;
  }

  // mode === "new_with_existing"
  return `Create a NEW workflow, but incorporate nodes similar to the ones in my existing workflow. Use them as building blocks or reference for the new workflow.

EXISTING NODES (for reference):
${existingNodes}

USER REQUEST: ${prompt}

IMPORTANT RULES FOR NEW WITH EXISTING MODE:
- Create a brand new workflow template with new node IDs
- Use the existing node kinds as inspiration — reuse similar node types where it makes sense
- Generate fresh node IDs (do NOT reuse the existing IDs)
- Build the workflow from scratch based on the user's request, but informed by the existing nodes
- Start with a trigger node and lay out nodes left-to-right`;
}

async function callLlmForWorkflow(
  provider: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ template: object; explanation: string }> {
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
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
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
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.3,
        max_tokens: 4000,
      };
      break;
    case "gemini":
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      headers = { "Content-Type": "application/json" };
      body = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 4000 },
      };
      break;
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
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

  const json = (await response.json()) as Record<string, any>;
  let content: string;

  switch (provider) {
    case "openai":
      content = json.choices?.[0]?.message?.content ?? "";
      break;
    case "anthropic":
      content = json.content?.[0]?.text ?? "";
      break;
    case "gemini":
      content = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      break;
    default:
      content = "";
  }

  // Strip markdown code fences if present
  content = content
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  let template: object;
  try {
    template = JSON.parse(content);
  } catch {
    throw new Error(
      "Failed to parse LLM response as valid JSON workflow template",
    );
  }

  return {
    template,
    explanation: `Generated a workflow with ${(template as any).nodes?.length ?? 0} nodes based on your description.`,
  };
}

// ---------------------------------------------------------------------------
// API Token management
// ---------------------------------------------------------------------------

// GET /api/auth/tokens — list tokens for the logged-in user
authRouter.get("/tokens", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    res.json(await apiTokenService.listTokens(userId));
  } catch (err) {
    res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});

// POST /api/auth/tokens  { name } — create token
authRouter.post("/tokens", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { name } = req.body as { name: string };
    const result = await apiTokenService.createToken(userId, name);
    res.status(201).json(result); // raw token included ONCE
  } catch (err) {
    res.status(errStatus(err)).json({ error: (err as Error).message });
  }
});

// DELETE /api/auth/tokens/:id — revoke
authRouter.delete(
  "/tokens/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      await apiTokenService.revokeToken(req.params.id, userId);
      res.status(204).send();
    } catch (err) {
      res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// ---------------------------------------------------------------------------
// MFA — verify login challenge (called after password login when MFA is required)
// POST /api/auth/mfa/verify-login
//   Body: { challengeToken, method: "totp"|"email"|"backup", code, emailChallengeId? }
// ---------------------------------------------------------------------------
authRouter.post("/mfa/verify-login", async (req: Request, res: Response) => {
  const { challengeToken, method, code, emailChallengeId } = req.body as {
    challengeToken?: string;
    method?: "totp" | "email" | "backup";
    code?: string;
    emailChallengeId?: string;
  };

  if (!challengeToken || !method || !code) {
    return res
      .status(400)
      .json({ error: "challengeToken, method, and code are required" });
  }

  // Resolve the userId from the challenge token
  const userId = await mfaService.verifyLoginChallenge(challengeToken);
  if (!userId) {
    return res.status(401).json({ error: "Invalid or expired MFA challenge" });
  }

  const userRow = await prisma.user.findUnique({ where: { id: userId } });
  if (!userRow) return res.status(401).json({ error: "User not found" });

  let verified = false;

  if (method === "totp") {
    if (!userRow.mfaTotpEnabled || !userRow.mfaTotpSecret) {
      return res
        .status(400)
        .json({ error: "TOTP is not enabled for this account" });
    }
    verified = mfaService.verifyTotpCode(userRow.mfaTotpSecret, code);
  } else if (method === "email") {
    if (!emailChallengeId) {
      return res
        .status(400)
        .json({ error: "emailChallengeId is required for email OTP" });
    }
    verified = await mfaService.verifyEmailOtp(emailChallengeId, code);
  } else if (method === "backup") {
    verified = await mfaService.useBackupCode(userId, code);
  }

  if (!verified) {
    logger.warn("MFA verification failed", { userId, method });
    return res.status(401).json({ error: "Invalid verification code" });
  }

  // Issue the full JWT
  const orgs = await organizationService.listUserOrganizations(userId);
  const user = userService.toPublic(userRow);

  if (orgs.length === 1) {
    const membership = await organizationService.getOrgMembership(
      userId,
      orgs[0].id,
    );
    const token = jwt.sign(
      {
        sub: userId,
        username: userRow.username,
        role: membership?.role ?? userRow.role,
        orgId: orgs[0].id,
      },
      config.JWT_SECRET,
      { expiresIn: JWT_EXPIRY },
    );
    logger.info("MFA login complete (single org)", {
      userId,
      orgId: orgs[0].id,
      method,
    });
    return res.json({
      token,
      expiresIn: JWT_EXPIRY,
      user,
      organization: orgs[0],
    });
  }

  const token = jwt.sign(
    { sub: userId, username: userRow.username, role: userRow.role },
    config.JWT_SECRET,
    { expiresIn: JWT_EXPIRY },
  );
  logger.info("MFA login complete (multi-org)", {
    userId,
    orgCount: orgs.length,
    method,
  });
  return res.json({ token, expiresIn: JWT_EXPIRY, user, organizations: orgs });
});

// POST /api/auth/mfa/resend-email — resend email OTP during login challenge
authRouter.post("/mfa/resend-email", async (req: Request, res: Response) => {
  const { challengeToken } = req.body as { challengeToken?: string };
  if (!challengeToken)
    return res.status(400).json({ error: "challengeToken is required" });

  // We need to verify but NOT consume the challenge
  const codeHash = crypto
    .createHash("sha256")
    .update(challengeToken)
    .digest("hex");
  const challenge = await prisma.mfaChallenge.findFirst({
    where: { codeHash, type: "login_pending", used: false },
    include: { user: true },
  });

  if (!challenge || challenge.expiresAt < new Date()) {
    return res.status(401).json({ error: "Invalid or expired challenge" });
  }

  const emailChallengeId = await mfaService.sendEmailOtp(
    challenge.userId,
    challenge.user.email,
  );
  return res.json({ emailChallengeId });
});

// ---------------------------------------------------------------------------
// MFA management routes (authenticated)
// ---------------------------------------------------------------------------

// GET /api/auth/mfa/status
authRouter.get(
  "/mfa/status",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      if (!userId)
        return res
          .status(400)
          .json({ error: "JWT-authenticated user required" });
      const status = await mfaService.getMfaStatus(userId);
      return res.json(status);
    } catch (err) {
      return res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// POST /api/auth/mfa/totp/setup — initiate TOTP setup, returns secret + QR code URL
authRouter.post(
  "/mfa/totp/setup",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      if (!userId)
        return res
          .status(400)
          .json({ error: "JWT-authenticated user required" });
      const userRow = await prisma.user.findUnique({ where: { id: userId } });
      if (!userRow) return res.status(404).json({ error: "User not found" });
      const result = await mfaService.generateTotpSetup(
        userId,
        userRow.username,
      );
      return res.json(result);
    } catch (err) {
      return res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// POST /api/auth/mfa/totp/enable  { code }
authRouter.post(
  "/mfa/totp/enable",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      if (!userId)
        return res
          .status(400)
          .json({ error: "JWT-authenticated user required" });
      const { code } = req.body as { code?: string };
      if (!code) return res.status(400).json({ error: "code is required" });
      const result = await mfaService.enableTotp(userId, code);
      return res.json(result);
    } catch (err) {
      return res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// POST /api/auth/mfa/totp/disable  { code }
authRouter.post(
  "/mfa/totp/disable",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      if (!userId)
        return res
          .status(400)
          .json({ error: "JWT-authenticated user required" });
      const { code } = req.body as { code?: string };
      if (!code) return res.status(400).json({ error: "code is required" });
      await mfaService.disableTotp(userId, code);
      return res.status(204).send();
    } catch (err) {
      return res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// POST /api/auth/mfa/email/enable
authRouter.post(
  "/mfa/email/enable",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      if (!userId)
        return res
          .status(400)
          .json({ error: "JWT-authenticated user required" });
      await mfaService.enableEmailOtp(userId);
      return res.status(204).send();
    } catch (err) {
      return res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// POST /api/auth/mfa/email/disable
authRouter.post(
  "/mfa/email/disable",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      if (!userId)
        return res
          .status(400)
          .json({ error: "JWT-authenticated user required" });
      await mfaService.disableEmailOtp(userId);
      return res.status(204).send();
    } catch (err) {
      return res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// POST /api/auth/mfa/backup-codes/regenerate  { code } — TOTP code required
authRouter.post(
  "/mfa/backup-codes/regenerate",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      if (!userId)
        return res
          .status(400)
          .json({ error: "JWT-authenticated user required" });
      const { code } = req.body as { code?: string };
      if (!code)
        return res.status(400).json({ error: "TOTP code is required" });
      const result = await mfaService.regenerateBackupCodes(userId, code);
      return res.json(result);
    } catch (err) {
      return res.status(errStatus(err)).json({ error: (err as Error).message });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/auth/mfa/recover/start
// Step 1 of self-service MFA recovery: verify password, send email OTP.
// Body: { usernameOrEmail, password }
// Returns: { challengeId, emailMasked } — client shows the masked address
// ---------------------------------------------------------------------------
authRouter.post("/mfa/recover/start", async (req: Request, res: Response) => {
  const { usernameOrEmail, password } = req.body as {
    usernameOrEmail?: string;
    password?: string;
  };

  if (!usernameOrEmail || !password) {
    return res
      .status(400)
      .json({ error: "usernameOrEmail and password are required" });
  }

  const user = await userService.authenticate(
    usernameOrEmail,
    password,
    req.ip ?? undefined,
  );
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (!user.email) {
    return res.status(422).json({
      error:
        "No email address is associated with this account. Contact an administrator.",
    });
  }

  const challengeId = await mfaService.sendRecoveryOtp(user.id, user.email);

  // Mask the email: s***@example.com
  const [local, domain] = user.email.split("@");
  const emailMasked = `${local[0]}***@${domain}`;

  logger.info("MFA recovery OTP sent", { userId: user.id, ip: req.ip });
  return res.json({ challengeId, emailMasked });
});

// ---------------------------------------------------------------------------
// POST /api/auth/mfa/recover/confirm
// Step 2 of self-service MFA recovery: verify email OTP, then clear all MFA.
// Body: { challengeId, emailCode }
// ---------------------------------------------------------------------------
authRouter.post("/mfa/recover/confirm", async (req: Request, res: Response) => {
  const { challengeId, emailCode } = req.body as {
    challengeId?: string;
    emailCode?: string;
  };

  if (!challengeId || !emailCode) {
    return res
      .status(400)
      .json({ error: "challengeId and emailCode are required" });
  }

  const userId = await mfaService.verifyRecoveryOtp(challengeId, emailCode);
  if (!userId) {
    return res
      .status(401)
      .json({ error: "Invalid or expired verification code" });
  }

  // Clear all MFA
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaTotpEnabled: false,
      mfaTotpSecret: null,
      mfaEmailEnabled: false,
      mfaBackupCodes: [],
    },
  });

  // Invalidate any pending MFA login challenges
  await prisma.mfaChallenge.updateMany({
    where: { userId, used: false },
    data: { used: true },
  });

  logger.info("MFA reset via self-service recovery (email verified)", {
    userId,
    ip: req.ip,
  });

  return res.json({
    message:
      "MFA has been cleared. You can now log in with your password and re-enroll in MFA.",
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/mfa/admin/reset/:userId
// Admin-only: forcefully clear all MFA for any user.
// Requires admin role (master API_TOKEN or JWT with role=admin/owner).
// ---------------------------------------------------------------------------
authRouter.post(
  "/mfa/admin/reset/:userId",
  requireAuth,
  async (req: Request, res: Response) => {
    const callerRole = (req as any).userRole as string | undefined;
    if (callerRole !== "admin" && callerRole !== "owner") {
      return res.status(403).json({ error: "Admin or owner role required" });
    }

    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return res.status(404).json({ error: "User not found" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaTotpEnabled: false,
        mfaTotpSecret: null,
        mfaEmailEnabled: false,
        mfaBackupCodes: [],
      },
    });

    await prisma.mfaChallenge.updateMany({
      where: { userId, used: false },
      data: { used: true },
    });

    logger.info("MFA reset by admin", {
      targetUserId: userId,
      adminUserId: (req as any).userId,
    });

    return res.json({
      message: `MFA cleared for user ${target.username}. They can now log in with their password.`,
    });
  },
);
