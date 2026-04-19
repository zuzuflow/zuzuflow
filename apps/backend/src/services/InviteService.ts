import crypto from "crypto";
import { prisma } from "../db/client";
import { logger } from "../logger";
import { config } from "../config";

// =============================================================================
// InviteService — pending invites for users to join an organization.
//
// Raw token: 32 random bytes → 64 hex chars. Included ONCE in the invite email
// link. We store only the sha256 hash so a DB compromise doesn't leak usable
// invite URLs. On accept we re-hash the incoming token and compare.
// =============================================================================

const INVITE_EXPIRY_DAYS = 7;

export type OrgInviteRole = "admin" | "member";

export interface OrgInviteRecord {
  id: string;
  organizationId: string;
  organizationName: string;
  invitedEmail: string;
  role: string;
  invitedByUserId: string;
  invitedByName?: string;
  expiresAt: string;
  createdAt: string;
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function appUrl(): string {
  return config.APP_URL || config.CORS_ORIGINS[0] || "http://localhost:3000";
}

export class InviteService {
  /**
   * Create a pending invite for {email} to join {organizationId} as {role}.
   *
   * Returns the raw token so the route handler can include it in the invite
   * email link. The raw token is never persisted — only its sha256 hash.
   *
   * Throws with code:
   *   - CONFLICT  → user is already a member of this org
   *   - CONFLICT  → an active (non-expired) invite for this email already exists
   *   - VALIDATION_ERROR → invalid role / email
   */
  async createInvite(
    organizationId: string,
    email: string,
    role: OrgInviteRole,
    inviterUserId: string,
  ): Promise<{ invite: OrgInviteRecord; rawToken: string; acceptUrl: string; targetUserExists: boolean }> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes("@")) {
      throw Object.assign(new Error("A valid email is required"), { code: "VALIDATION_ERROR" });
    }
    if (role !== "admin" && role !== "member") {
      throw Object.assign(new Error("Role must be 'admin' or 'member'"), { code: "VALIDATION_ERROR" });
    }

    // Is the target already a member of this org?
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      const alreadyMember = await prisma.orgMember.findUnique({
        where: { userId_organizationId: { userId: existingUser.id, organizationId } },
      });
      if (alreadyMember) {
        throw Object.assign(new Error(`${normalizedEmail} is already a member of this organization`), {
          code: "CONFLICT",
        });
      }
    }

    // Already a pending invite? If expired, replace it; if active, reject.
    const existingInvite = await prisma.orgInvite.findUnique({
      where: { organizationId_invitedEmail: { organizationId, invitedEmail: normalizedEmail } },
    });
    if (existingInvite) {
      if (existingInvite.expiresAt > new Date()) {
        throw Object.assign(
          new Error(`An invite is already pending for ${normalizedEmail}. Revoke it first if you want to re-send.`),
          { code: "CONFLICT" },
        );
      }
      // Expired — remove so the unique constraint doesn't reject the new one
      await prisma.orgInvite.delete({ where: { id: existingInvite.id } });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const inviteTokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const invite = await prisma.orgInvite.create({
      data: {
        organizationId,
        invitedEmail: normalizedEmail,
        role,
        invitedByUserId: inviterUserId,
        inviteTokenHash,
        expiresAt,
      },
      include: {
        organization: { select: { name: true } },
        invitedBy: { select: { username: true } },
      },
    });

    const acceptUrl = `${appUrl()}/invite/${rawToken}`;
    logger.info("Invite created", {
      organizationId,
      email: normalizedEmail,
      role,
      targetUserExists: !!existingUser,
    });

    return {
      invite: this._toRecord(invite),
      rawToken,
      acceptUrl,
      targetUserExists: !!existingUser,
    };
  }

  /** Resolve a raw token to a DB invite. Throws NOT_FOUND if missing, EXPIRED if past deadline. */
  async resolveInvite(rawToken: string) {
    const invite = await prisma.orgInvite.findUnique({
      where: { inviteTokenHash: hashToken(rawToken) },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        invitedBy: { select: { username: true } },
      },
    });
    if (!invite) throw Object.assign(new Error("Invite not found or already used"), { code: "NOT_FOUND" });
    if (invite.expiresAt <= new Date()) {
      // Best-effort cleanup
      await prisma.orgInvite.delete({ where: { id: invite.id } }).catch(() => void 0);
      throw Object.assign(new Error("This invite has expired"), { code: "EXPIRED" });
    }
    return invite;
  }

  /**
   * Accept an invite on behalf of the given user. Validates that the accepting
   * user's email matches the invited email. Creates an OrgMember row and
   * deletes the invite, all in a single transaction.
   */
  async acceptInvite(rawToken: string, acceptingUserId: string): Promise<{ organizationId: string; organizationName: string; role: string }> {
    const invite = await this.resolveInvite(rawToken);
    const user = await prisma.user.findUnique({ where: { id: acceptingUserId } });
    if (!user) throw Object.assign(new Error("User not found"), { code: "NOT_FOUND" });
    if (user.email.toLowerCase() !== invite.invitedEmail.toLowerCase()) {
      throw Object.assign(
        new Error("This invite was sent to a different email address. Log in with that account to accept."),
        { code: "FORBIDDEN" },
      );
    }

    await prisma.$transaction(async (tx: any) => {
      // Idempotent — if they're somehow already a member, just delete the invite
      await tx.orgMember.upsert({
        where: {
          userId_organizationId: {
            userId: acceptingUserId,
            organizationId: invite.organizationId,
          },
        },
        create: {
          userId: acceptingUserId,
          organizationId: invite.organizationId,
          role: invite.role,
        },
        update: {},
      });
      await tx.orgInvite.delete({ where: { id: invite.id } });
    });

    logger.info("Invite accepted", {
      inviteId: invite.id,
      userId: acceptingUserId,
      organizationId: invite.organizationId,
    });

    return {
      organizationId: invite.organizationId,
      organizationName: invite.organization.name,
      role: invite.role,
    };
  }

  /** Decline — simply deletes the invite. */
  async declineInvite(rawToken: string, decliningUserId: string): Promise<void> {
    const invite = await this.resolveInvite(rawToken);
    const user = await prisma.user.findUnique({ where: { id: decliningUserId } });
    if (!user || user.email.toLowerCase() !== invite.invitedEmail.toLowerCase()) {
      throw Object.assign(new Error("This invite isn't addressed to you"), { code: "FORBIDDEN" });
    }
    await prisma.orgInvite.delete({ where: { id: invite.id } });
    logger.info("Invite declined", { inviteId: invite.id, userId: decliningUserId });
  }

  /**
   * Accept by invite ID — used by the in-app bell where the user never has the
   * raw token (it's in their email). Still safe: we verify the authed user's
   * email matches the invite's invitedEmail, so an attacker can't accept an
   * invite addressed to someone else.
   */
  async acceptInviteById(
    inviteId: string,
    acceptingUserId: string,
  ): Promise<{ organizationId: string; organizationName: string; role: string }> {
    const invite = await prisma.orgInvite.findUnique({
      where: { id: inviteId },
      include: { organization: { select: { id: true, name: true, slug: true } } },
    });
    if (!invite) throw Object.assign(new Error("Invite not found"), { code: "NOT_FOUND" });
    if (invite.expiresAt <= new Date()) {
      await prisma.orgInvite.delete({ where: { id: invite.id } }).catch(() => void 0);
      throw Object.assign(new Error("This invite has expired"), { code: "EXPIRED" });
    }

    const user = await prisma.user.findUnique({ where: { id: acceptingUserId } });
    if (!user) throw Object.assign(new Error("User not found"), { code: "NOT_FOUND" });
    if (user.email.toLowerCase() !== invite.invitedEmail.toLowerCase()) {
      throw Object.assign(new Error("This invite isn't addressed to you"), { code: "FORBIDDEN" });
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.orgMember.upsert({
        where: {
          userId_organizationId: {
            userId: acceptingUserId,
            organizationId: invite.organizationId,
          },
        },
        create: {
          userId: acceptingUserId,
          organizationId: invite.organizationId,
          role: invite.role,
        },
        update: {},
      });
      await tx.orgInvite.delete({ where: { id: invite.id } });
    });

    logger.info("Invite accepted (by id)", {
      inviteId: invite.id,
      userId: acceptingUserId,
      organizationId: invite.organizationId,
    });
    return {
      organizationId: invite.organizationId,
      organizationName: invite.organization.name,
      role: invite.role,
    };
  }

  /** Decline by invite ID — companion to acceptInviteById. */
  async declineInviteById(inviteId: string, decliningUserId: string): Promise<void> {
    const invite = await prisma.orgInvite.findUnique({ where: { id: inviteId } });
    if (!invite) return; // idempotent
    const user = await prisma.user.findUnique({ where: { id: decliningUserId } });
    if (!user || user.email.toLowerCase() !== invite.invitedEmail.toLowerCase()) {
      throw Object.assign(new Error("This invite isn't addressed to you"), { code: "FORBIDDEN" });
    }
    await prisma.orgInvite.delete({ where: { id: invite.id } });
    logger.info("Invite declined (by id)", { inviteId, userId: decliningUserId });
  }

  /** List pending invites for an org (for the inviter's view). */
  async listPendingForOrg(organizationId: string): Promise<OrgInviteRecord[]> {
    const rows = await prisma.orgInvite.findMany({
      where: { organizationId, expiresAt: { gt: new Date() } },
      include: {
        organization: { select: { name: true } },
        invitedBy: { select: { username: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(this._toRecord);
  }

  /** List pending invites addressed to a specific email (for the bell icon). */
  async listPendingForEmail(email: string): Promise<OrgInviteRecord[]> {
    const rows = await prisma.orgInvite.findMany({
      where: {
        invitedEmail: email.toLowerCase(),
        expiresAt: { gt: new Date() },
      },
      include: {
        organization: { select: { name: true } },
        invitedBy: { select: { username: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(this._toRecord);
  }

  /**
   * Fetch an invite addressed to the given email + return its raw-token substitute
   * (the sha256 hash). Used by the TopNav bell which needs an accept token per
   * invite but doesn't have the raw token.
   *
   * NOTE: We return the hash as the "token" for authed accept calls. The authed
   * accept endpoint accepts either the raw token or (if the user owns the email)
   * the hash — see routes/auth.ts.
   */

  /**
   * Revoke a pending invite. Any org admin/owner can revoke invites their org
   * sent.
   */
  async revokeInvite(inviteId: string, requestingUserOrgIds: string[]): Promise<void> {
    const invite = await prisma.orgInvite.findUnique({ where: { id: inviteId } });
    if (!invite) throw Object.assign(new Error("Invite not found"), { code: "NOT_FOUND" });
    if (!requestingUserOrgIds.includes(invite.organizationId)) {
      throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" });
    }
    await prisma.orgInvite.delete({ where: { id: inviteId } });
    logger.info("Invite revoked", { inviteId, organizationId: invite.organizationId });
  }

  /** Public invite info — no auth required. Used by the /invite/:token landing page. */
  async getPublicInvite(rawToken: string): Promise<{
    organizationName: string;
    invitedEmail: string;
    role: string;
    inviterName: string;
    expiresAt: string;
    userExists: boolean;
  }> {
    const invite = await this.resolveInvite(rawToken);
    const user = await prisma.user.findUnique({
      where: { email: invite.invitedEmail },
      select: { id: true },
    });
    return {
      organizationName: invite.organization.name,
      invitedEmail: invite.invitedEmail,
      role: invite.role,
      inviterName: invite.invitedBy.username,
      expiresAt: invite.expiresAt.toISOString(),
      userExists: !!user,
    };
  }

  private _toRecord(row: {
    id: string;
    organizationId: string;
    organization?: { name?: string };
    invitedEmail: string;
    role: string;
    invitedByUserId: string;
    invitedBy?: { username?: string };
    expiresAt: Date;
    createdAt: Date;
  }): OrgInviteRecord {
    return {
      id: row.id,
      organizationId: row.organizationId,
      organizationName: row.organization?.name ?? "",
      invitedEmail: row.invitedEmail,
      role: row.role,
      invitedByUserId: row.invitedByUserId,
      invitedByName: row.invitedBy?.username,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }
}

export const inviteService = new InviteService();
