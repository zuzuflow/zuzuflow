import bcrypt from "bcryptjs";
import { prisma } from "../db/client";
import { logger } from "../logger";
import { config } from "../config";
import { organizationService } from "./OrganizationService";

const SALT_ROUNDS = 12;

export interface UserPublic {
  id: string;
  username: string;
  email: string;
  role: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
  createdAt: string;
}

export class UserService {
  // ---------------------------------------------------------------------------
  // Seed: ensure at least one admin exists on startup
  // ---------------------------------------------------------------------------
  async ensureAdminExists(): Promise<void> {
    const count = await prisma.user.count();
    if (count > 0) return;

    const username = config.INITIAL_ADMIN_USERNAME;
    const password = config.INITIAL_ADMIN_PASSWORD;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: { username, email: `${username}@admin.local`, passwordHash, role: "superadmin" },
    });
    logger.info(`Created initial superadmin user: ${username}`);

    // Grant admin access to all existing environments
    const environments = await prisma.environment.findMany();
    for (const env of environments) {
      await prisma.userEnvironment.create({
        data: { userId: user.id, environmentId: env.id, role: "admin" },
      });
      logger.info(`Granted admin access to environment: ${env.slug}`);
    }

    // Create a default organization if none exist
    const orgCount = await prisma.organization.count();
    if (orgCount === 0) {
      await organizationService.createOrgWithOwner("Default Organization", user.id);
      logger.info("Created default organization for initial admin user");
    }
  }

  // ---------------------------------------------------------------------------
  // Authenticate — returns user or null; supports login by email or username
  // ---------------------------------------------------------------------------
  async authenticate(usernameOrEmail: string, password: string, ip?: string): Promise<UserPublic | null> {
    const isEmail = usernameOrEmail.includes("@");
    const user = isEmail
      ? await prisma.user.findUnique({ where: { email: usernameOrEmail } })
      : await prisma.user.findUnique({ where: { username: usernameOrEmail } });

    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;

    // Update last login info
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip || null },
    });

    return this._toPublic({ ...user, lastLoginAt: new Date(), lastLoginIp: ip || null });
  }

  // ---------------------------------------------------------------------------
  // Signup — creates user + default org in one step
  // ---------------------------------------------------------------------------
  async signup(
    username: string,
    email: string,
    password: string,
  ): Promise<{ user: UserPublic; organizationId: string }> {
    if (!username.trim()) throw Object.assign(new Error("username is required"), { code: "VALIDATION_ERROR" });
    if (!email.trim() || !email.includes("@")) throw Object.assign(new Error("a valid email is required"), { code: "VALIDATION_ERROR" });
    if (password.length < 8) throw Object.assign(new Error("password must be at least 8 characters"), { code: "VALIDATION_ERROR" });

    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) throw Object.assign(new Error(`Username "${username}" is already taken`), { code: "CONFLICT" });

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) throw Object.assign(new Error(`Email "${email}" is already registered`), { code: "CONFLICT" });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { username: username.trim(), email: email.trim().toLowerCase(), passwordHash, role: "editor" },
    });
    logger.info("User signed up", { userId: user.id, username: user.username });

    // Create a personal org for the new user (named after username)
    const org = await organizationService.createOrgWithOwner(`${username}'s Organization`, user.id);

    return { user: this._toPublic(user), organizationId: org.id };
  }

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------
  async listUsers(): Promise<UserPublic[]> {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
    return users.map(this._toPublic);
  }

  // ---------------------------------------------------------------------------
  // Create — email is now required
  // ---------------------------------------------------------------------------
  async createUser(
    username: string,
    email: string,
    password: string,
    role: "admin" | "editor" = "editor",
  ): Promise<UserPublic> {
    if (!username.trim()) throw Object.assign(new Error("username is required"), { code: "VALIDATION_ERROR" });
    if (!email.trim() || !email.includes("@")) throw Object.assign(new Error("a valid email is required"), { code: "VALIDATION_ERROR" });
    if (password.length < 8) throw Object.assign(new Error("password must be at least 8 characters"), { code: "VALIDATION_ERROR" });

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) throw Object.assign(new Error(`Username "${username}" is already taken`), { code: "CONFLICT" });

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) throw Object.assign(new Error(`Email "${email}" is already registered`), { code: "CONFLICT" });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        role,
      },
    });
    logger.info("User created", { userId: user.id, username: user.username, role });
    return this._toPublic(user);
  }

  // ---------------------------------------------------------------------------
  // Change password
  // ---------------------------------------------------------------------------
  async changePassword(id: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) throw Object.assign(new Error("password must be at least 8 characters"), { code: "VALIDATION_ERROR" });
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({ where: { id }, data: { passwordHash } }).catch(() => {
      throw Object.assign(new Error("User not found"), { code: "NOT_FOUND" });
    });
    logger.info("Password changed", { userId: id });
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  async deleteUser(id: string): Promise<void> {
    const remaining = await prisma.user.count();
    if (remaining <= 1) throw Object.assign(new Error("Cannot delete the last user"), { code: "VALIDATION_ERROR" });
    await prisma.user.delete({ where: { id } }).catch(() => {
      throw Object.assign(new Error("User not found"), { code: "NOT_FOUND" });
    });
    logger.info("User deleted", { userId: id });
  }

  private _toPublic(u: {
    id: string;
    username: string;
    email: string | null;
    role: string;
    lastLoginAt?: Date | null;
    lastLoginIp?: string | null;
    createdAt: Date;
  }): UserPublic {
    const pub: UserPublic = {
      id: u.id,
      username: u.username,
      email: u.email ?? "",
      role: u.role,
      createdAt: u.createdAt.toISOString(),
    };
    if (u.lastLoginAt) pub.lastLoginAt = u.lastLoginAt.toISOString();
    if (u.lastLoginIp) pub.lastLoginIp = u.lastLoginIp;
    return pub;
  }
}

export const userService = new UserService();
