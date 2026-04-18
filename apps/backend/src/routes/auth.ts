import { Router, Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { logger } from "../logger";
import { userService } from "../services/UserService";
import { apiTokenService } from "../services/ApiTokenService";
import { organizationService } from "../services/OrganizationService";
import { mfaService } from "../services/MfaService";
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
// POST /api/auth/signup  { username, email, password } → { token, user, organization }
// ---------------------------------------------------------------------------
authRouter.post("/signup", async (req: Request, res: Response) => {
  if (!config.SIGNUP_ENABLED) {
    return res.status(403).json({ error: "Signup is disabled" });
  }

  const { username, email, password } = req.body as {
    username?: string;
    email?: string;
    password?: string;
  };
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
    const org = await organizationService.listUserOrganizations(user.id);
    const organization = org.find((o) => o.id === organizationId) ?? org[0];

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
        orgId: organizationId,
      },
      config.JWT_SECRET,
      { expiresIn: JWT_EXPIRY },
    );

    logger.info("Signup successful", {
      userId: user.id,
      username: user.username,
      orgId: organizationId,
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
authRouter.get("/users", requireAuth, async (_req, res) => {
  try {
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
