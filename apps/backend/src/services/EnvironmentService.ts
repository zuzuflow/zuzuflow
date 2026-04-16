import { prisma } from "../db/client";
import { logger } from "../logger";

// =============================================================================
// EnvironmentService — CRUD for environments + user membership
// =============================================================================

export interface EnvironmentItem {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentMember {
  id: string;
  userId: string;
  username: string;
  role: string;
  createdAt: string;
}

export class EnvironmentService {
  // ---------------------------------------------------------------------------
  // List all environments (admin) or environments a user belongs to
  // ---------------------------------------------------------------------------
  async listEnvironments(userId?: string, organizationId?: string): Promise<EnvironmentItem[]> {
    if (userId) {
      // Return only environments the user is a member of
      const memberships = await prisma.userEnvironment.findMany({
        where: {
          userId,
          ...(organizationId ? { environment: { organizationId } } : {}),
        },
        include: { environment: true },
        orderBy: { environment: { name: "asc" } },
      });
      return memberships.map((m) => this._toItem(m.environment));
    }
    // Admin / API token: return all environments (optionally filtered by org)
    const rows = await prisma.environment.findMany({
      where: organizationId ? { organizationId } : {},
      orderBy: { name: "asc" },
    });
    return rows.map(this._toItem);
  }

  // ---------------------------------------------------------------------------
  // Get by ID
  // ---------------------------------------------------------------------------
  async getEnvironment(id: string): Promise<EnvironmentItem> {
    const env = await prisma.environment.findUnique({ where: { id } });
    if (!env) throw Object.assign(new Error(`Environment ${id} not found`), { code: "NOT_FOUND" });
    return this._toItem(env);
  }

  // ---------------------------------------------------------------------------
  // Get by slug
  // ---------------------------------------------------------------------------
  async getEnvironmentBySlug(slug: string, organizationId?: string): Promise<EnvironmentItem | null> {
    const env = organizationId
      ? await prisma.environment.findUnique({
          where: { organizationId_slug: { organizationId, slug } },
        })
      : await prisma.environment.findFirst({ where: { slug } });
    return env ? this._toItem(env) : null;
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------
  async createEnvironment(input: { name: string; slug: string; organizationId: string }): Promise<EnvironmentItem> {
    if (!input.name.trim()) throw Object.assign(new Error("name is required"), { code: "VALIDATION_ERROR" });
    if (!input.slug.trim()) throw Object.assign(new Error("slug is required"), { code: "VALIDATION_ERROR" });
    if (!input.organizationId) throw Object.assign(new Error("organizationId is required"), { code: "VALIDATION_ERROR" });

    // Validate slug format (lowercase alphanumeric + hyphens)
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(input.slug)) {
      throw Object.assign(new Error("slug must be lowercase alphanumeric with hyphens"), { code: "VALIDATION_ERROR" });
    }

    // Check uniqueness within the organization (org + slug is the unique constraint)
    const existing = await prisma.environment.findUnique({
      where: { organizationId_slug: { organizationId: input.organizationId, slug: input.slug } },
    });
    if (existing) throw Object.assign(new Error(`Environment slug "${input.slug}" already exists in this organization`), { code: "CONFLICT" });

    const env = await prisma.environment.create({
      data: {
        name: input.name.trim(),
        slug: input.slug.trim(),
        isDefault: false,
        organizationId: input.organizationId,
      },
    });
    logger.info("Environment created", { id: env.id, name: env.name, slug: env.slug, organizationId: input.organizationId });
    return this._toItem(env);
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------
  async updateEnvironment(id: string, input: { name?: string; slug?: string }): Promise<EnvironmentItem> {
    const existing = await prisma.environment.findUnique({ where: { id } });
    if (!existing) throw Object.assign(new Error(`Environment ${id} not found`), { code: "NOT_FOUND" });

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.slug !== undefined) {
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(input.slug)) {
        throw Object.assign(new Error("slug must be lowercase alphanumeric with hyphens"), { code: "VALIDATION_ERROR" });
      }
      data.slug = input.slug.trim();
    }

    const env = await prisma.environment.update({ where: { id }, data: data as any });
    logger.info("Environment updated", { id: env.id });
    return this._toItem(env);
  }

  // ---------------------------------------------------------------------------
  // Delete (cannot delete default environment)
  // ---------------------------------------------------------------------------
  async deleteEnvironment(id: string): Promise<void> {
    const env = await prisma.environment.findUnique({ where: { id } });
    if (!env) throw Object.assign(new Error(`Environment ${id} not found`), { code: "NOT_FOUND" });
    if (env.isDefault) throw Object.assign(new Error("Cannot delete the default environment"), { code: "VALIDATION_ERROR" });

    // Cascade delete will remove all associated data
    await prisma.environment.delete({ where: { id } });
    logger.info("Environment deleted", { id, name: env.name });
  }

  // ---------------------------------------------------------------------------
  // Membership management
  // ---------------------------------------------------------------------------
  async listMembers(environmentId: string): Promise<EnvironmentMember[]> {
    const memberships = await prisma.userEnvironment.findMany({
      where: { environmentId },
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      username: m.user.username,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async addMember(environmentId: string, userId: string, role: string = "editor"): Promise<EnvironmentMember> {
    // Verify environment and user exist
    const env = await prisma.environment.findUnique({ where: { id: environmentId } });
    if (!env) throw Object.assign(new Error("Environment not found"), { code: "NOT_FOUND" });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw Object.assign(new Error("User not found"), { code: "NOT_FOUND" });

    const membership = await prisma.userEnvironment.create({
      data: { userId, environmentId, role },
      include: { user: { select: { username: true } } },
    });
    logger.info("Member added to environment", { environmentId, userId, role });
    return {
      id: membership.id,
      userId: membership.userId,
      username: membership.user.username,
      role: membership.role,
      createdAt: membership.createdAt.toISOString(),
    };
  }

  async updateMemberRole(membershipId: string, role: string): Promise<void> {
    await prisma.userEnvironment.update({ where: { id: membershipId }, data: { role } }).catch(() => {
      throw Object.assign(new Error("Membership not found"), { code: "NOT_FOUND" });
    });
  }

  async removeMember(membershipId: string): Promise<void> {
    await prisma.userEnvironment.delete({ where: { id: membershipId } }).catch(() => {
      throw Object.assign(new Error("Membership not found"), { code: "NOT_FOUND" });
    });
  }

  // Check if a user has access to an environment
  async checkAccess(userId: string, environmentId: string): Promise<{ hasAccess: boolean; role: string | null }> {
    const membership = await prisma.userEnvironment.findUnique({
      where: { userId_environmentId: { userId, environmentId } },
    });
    return {
      hasAccess: !!membership,
      role: membership?.role ?? null,
    };
  }

  // Get default environment
  async getDefaultEnvironment(): Promise<EnvironmentItem> {
    const env = await prisma.environment.findFirst({ where: { isDefault: true } });
    if (!env) throw new Error("No default environment configured");
    return this._toItem(env);
  }

  private _toItem(e: { id: string; name: string; slug: string; isDefault: boolean; createdAt: Date; updatedAt: Date }): EnvironmentItem {
    return {
      id: e.id,
      name: e.name,
      slug: e.slug,
      isDefault: e.isDefault,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
  }
}

export const environmentService = new EnvironmentService();
