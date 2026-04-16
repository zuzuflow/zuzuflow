import { prisma } from "../db/client";

export interface FeatureFlagPublic {
  id: string;
  key: string;
  description: string | null;
  enabled: boolean;
  rules: unknown;
  createdAt: string;
  updatedAt: string;
}

class FeatureFlagService {
  async list(): Promise<FeatureFlagPublic[]> {
    const flags = await prisma.featureFlag.findMany({ orderBy: { key: "asc" } });
    return flags.map((f) => this._toPublic(f));
  }

  async get(key: string): Promise<FeatureFlagPublic | null> {
    const f = await prisma.featureFlag.findUnique({ where: { key } });
    return f ? this._toPublic(f) : null;
  }

  async create(data: { key: string; description?: string; enabled?: boolean; rules?: unknown }): Promise<FeatureFlagPublic> {
    const f = await prisma.featureFlag.create({
      data: {
        key: data.key,
        description: data.description,
        enabled: data.enabled ?? false,
        rules: data.rules as any,
      },
    });
    return this._toPublic(f);
  }

  async update(key: string, data: Partial<{ description: string; enabled: boolean; rules: unknown }>): Promise<FeatureFlagPublic> {
    const f = await prisma.featureFlag.update({
      where: { key },
      data: {
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.rules !== undefined ? { rules: data.rules as any } : {}),
      },
    });
    return this._toPublic(f);
  }

  async delete(key: string): Promise<void> {
    await prisma.featureFlag.delete({ where: { key } });
  }

  /** Runtime check — is this feature enabled (optionally scoped to an org)? */
  async isEnabled(key: string, orgId?: string): Promise<boolean> {
    const f = await prisma.featureFlag.findUnique({ where: { key } });
    if (!f || !f.enabled) return false;
    if (!orgId || !f.rules) return true;
    // If rules contain org targeting, check membership
    const rules = f.rules as { orgIds?: string[] };
    if (rules.orgIds && rules.orgIds.length > 0) {
      return rules.orgIds.includes(orgId);
    }
    return true;
  }

  private _toPublic(f: any): FeatureFlagPublic {
    return {
      id: f.id,
      key: f.key,
      description: f.description,
      enabled: f.enabled,
      rules: f.rules,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    };
  }
}

export const featureFlagService = new FeatureFlagService();
