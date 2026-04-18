import { prisma } from "../db/client";
import { logger } from "../logger";

// =============================================================================
// OrganizationService — CRUD for organizations + membership
// =============================================================================

export interface OrgPublic {
  id: string;
  name: string;
  slug: string;
  role: string;
  mfaEnforced: boolean;
  createdAt: string;
}

export interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  address?: string;
  mfaEnforced: boolean;
  createdAt: string;
  updatedAt: string;
}

export class OrganizationService {
  // ---------------------------------------------------------------------------
  // Create org with owner — sets up org, membership, default environment
  // ---------------------------------------------------------------------------
  async createOrgWithOwner(
    orgName: string,
    userId: string,
  ): Promise<OrgPublic> {
    if (!orgName.trim()) {
      throw Object.assign(new Error("Organization name is required"), {
        code: "VALIDATION_ERROR",
      });
    }

    const slug = await this._uniqueSlug(orgName);

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Create the organization
      const org = await tx.organization.create({
        data: { name: orgName.trim(), slug },
      });

      // 2. Add user as org owner
      await tx.orgMember.create({
        data: { userId, organizationId: org.id, role: "owner" },
      });

      // 3. Create default "Production" environment within the org
      const env = await tx.environment.create({
        data: {
          name: "Production",
          slug: "production",
          isDefault: true,
          organizationId: org.id,
        },
      });

      // 4. Add user to that environment as admin
      await tx.userEnvironment.create({
        data: { userId, environmentId: env.id, role: "admin" },
      });

      return org;
    });

    logger.info("Organization created with owner", {
      orgId: result.id,
      slug,
      userId,
    });

    return {
      id: result.id,
      name: result.name,
      slug: result.slug,
      role: "owner",
      mfaEnforced: result.mfaEnforced,
      createdAt: result.createdAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // List all organizations a user belongs to
  // ---------------------------------------------------------------------------
  async listUserOrganizations(userId: string): Promise<OrgPublic[]> {
    const memberships = await prisma.orgMember.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { organization: { name: "asc" } },
    });

    return memberships.map((m: (typeof memberships)[number]) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
      mfaEnforced: m.organization.mfaEnforced,
      createdAt: m.organization.createdAt.toISOString(),
    }));
  }

  // ---------------------------------------------------------------------------
  // Check membership — returns role or null
  // ---------------------------------------------------------------------------
  async getOrgMembership(
    userId: string,
    orgId: string,
  ): Promise<{ role: string } | null> {
    const membership = await prisma.orgMember.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
    });
    return membership ? { role: membership.role } : null;
  }

  // ---------------------------------------------------------------------------
  // Get org by ID
  // ---------------------------------------------------------------------------
  async getOrganization(orgId: string): Promise<OrgDetail | null> {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return null;
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      address: org.address ?? undefined,
      mfaEnforced: org.mfaEnforced,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Update org details
  // ---------------------------------------------------------------------------
  async updateOrganization(
    orgId: string,
    data: { name?: string; address?: string; mfaEnforced?: boolean },
  ): Promise<OrgDetail> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined && data.name.trim())
      updateData.name = data.name.trim();
    if (data.address !== undefined)
      updateData.address = data.address.trim() || null;
    if (data.mfaEnforced !== undefined)
      updateData.mfaEnforced = data.mfaEnforced;

    const org = await prisma.organization.update({
      where: { id: orgId },
      data: updateData,
    });

    logger.info("Organization updated", {
      orgId,
      fields: Object.keys(updateData),
    });

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      address: org.address ?? undefined,
      mfaEnforced: org.mfaEnforced,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Slugify — generate URL-safe slug, append random chars on collision
  // ---------------------------------------------------------------------------
  slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private async _uniqueSlug(name: string): Promise<string> {
    const base = this.slugify(name);
    if (!base) {
      throw Object.assign(
        new Error("Cannot generate slug from organization name"),
        { code: "VALIDATION_ERROR" },
      );
    }

    const existing = await prisma.organization.findUnique({
      where: { slug: base },
    });
    if (!existing) return base;

    // Collision: append random 4 characters
    const suffix = Math.random().toString(36).substring(2, 6);
    return `${base}-${suffix}`;
  }
}

export const organizationService = new OrganizationService();
