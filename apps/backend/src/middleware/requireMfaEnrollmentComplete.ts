import { Request, Response, NextFunction } from "express";
import { prisma } from "../db/client";

const ALLOWED_ROUTES: Array<{ method: string; path: string }> = [
  { method: "GET", path: "/auth/mfa/status" },
  { method: "POST", path: "/auth/mfa/totp/setup" },
  { method: "POST", path: "/auth/mfa/totp/enable" },
  { method: "POST", path: "/auth/mfa/email/enable" },
  { method: "POST", path: "/auth/mfa/backup-codes/regenerate" },
  { method: "GET", path: "/auth/organizations" },
  { method: "POST", path: "/auth/switch-org" },
  { method: "GET", path: "/auth/organization" },
];

function isAllowed(method: string, path: string): boolean {
  return ALLOWED_ROUTES.some(
    (route) => route.method === method && route.path === path,
  );
}

export async function requireMfaEnrollmentComplete(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const enrollmentOnly = !!(req as any).mfaEnrollmentOnly;
  if (!enrollmentOnly) {
    next();
    return;
  }

  const userId = (req as any).userId as string | undefined;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized — invalid enrollment token" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      mfaTotpEnabled: true,
      mfaEmailEnabled: true,
      mfaBackupCodes: true,
    },
  });

  if (!user) {
    res.status(401).json({ error: "Unauthorized — user not found" });
    return;
  }

  const enrolled =
    user.mfaTotpEnabled ||
    user.mfaEmailEnabled ||
    user.mfaBackupCodes.length > 0;

  // Once enrolled, this same token may continue and access is fully restored.
  if (enrolled) {
    next();
    return;
  }

  if (isAllowed(req.method, req.path)) {
    next();
    return;
  }

  res.status(403).json({
    error: "MFA enrollment required before accessing this resource",
    code: "MFA_ENROLLMENT_REQUIRED",
  });
}
