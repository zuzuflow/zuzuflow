import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { apiTokenService } from "../services/ApiTokenService";

/**
 * Bearer token authentication middleware.
 *
 * Accepts three token formats (checked in order):
 *   1. Master API_TOKEN  — static env-var token for CI/machine use
 *   2. JWT              — signed with JWT_SECRET, issued by POST /api/auth/login
 *   3. wf_* API token   — long-lived token stored (hashed) in the DB, created in Settings
 *
 * On success, attaches req.userId (string | null) and req.userRole.
 *
 * Routes excluded — handled before this middleware is mounted:
 *   POST /api/auth/login
 *   ALL  /api/webhooks/inbound/*  (HMAC-verified)
 *   ALL  /internal/*
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers["authorization"] as string | undefined;
  const queryToken = req.query["token"] as string | undefined;
  const raw = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : queryToken;

  if (!raw) {
    res.status(401).json({ error: "Unauthorized — missing token" });
    return;
  }

  // 1. Master API token (constant-time compare)
  if (raw.length === config.API_TOKEN.length) {
    let same = true;
    for (let i = 0; i < raw.length; i++) {
      if (raw.charCodeAt(i) !== config.API_TOKEN.charCodeAt(i)) same = false;
    }
    if (same) {
      (req as any).userId = null;
      (req as any).userRole = "admin";
      (req as any).organizationId = null; // full access
      next();
      return;
    }
  }

  // 2. JWT
  if (!raw.startsWith("wf_")) {
    try {
      const decoded = jwt.verify(raw, config.JWT_SECRET) as {
        sub: string;
        role?: string;
        orgId?: string;
        mfaEnrollmentOnly?: boolean;
      };
      (req as any).userId = decoded.sub;
      (req as any).userRole = decoded.role ?? "editor";
      (req as any).organizationId = decoded.orgId ?? null;
      (req as any).mfaEnrollmentOnly = !!decoded.mfaEnrollmentOnly;
      next();
      return;
    } catch {
      res
        .status(401)
        .json({ error: "Unauthorized — invalid or expired token" });
      return;
    }
  }

  // 3. wf_* DB-stored API token
  try {
    const valid = await apiTokenService.verifyRawToken(raw);
    if (valid) {
      (req as any).userId = null; // API tokens are not tied to a session user
      (req as any).userRole = "editor";
      (req as any).organizationId = null; // wf_* tokens get full access
      next();
      return;
    }
  } catch {
    // fall through to 401
  }

  res.status(401).json({ error: "Unauthorized — invalid token" });
}
