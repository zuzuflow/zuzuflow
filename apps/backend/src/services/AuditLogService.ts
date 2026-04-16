import { prisma } from "../db/client";

export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: unknown;
  ip: string | null;
  createdAt: string;
}

export interface AuditLogFilter {
  actorId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  from?: Date;
  to?: Date;
  cursor?: string;
  limit?: number;
}

class AuditLogService {
  async record(params: {
    actorId: string;
    action: string;
    targetType: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
    ip?: string;
  }): Promise<void> {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId ?? null,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
        ip: params.ip ?? null,
      },
    });
  }

  async list(filter: AuditLogFilter): Promise<{ items: AuditLogEntry[]; nextCursor: string | null }> {
    const limit = Math.min(filter.limit ?? 50, 100);

    const where: Record<string, unknown> = {};
    if (filter.actorId) where.actorId = filter.actorId;
    if (filter.action) where.action = filter.action;
    if (filter.targetType) where.targetType = filter.targetType;
    if (filter.targetId) where.targetId = filter.targetId;
    if (filter.from || filter.to) {
      where.createdAt = {
        ...(filter.from ? { gte: filter.from } : {}),
        ...(filter.to ? { lte: filter.to } : {}),
      };
    }
    if (filter.cursor) {
      where.id = { lt: filter.cursor };
    }

    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
      id: r.id,
      actorId: r.actorId,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      metadata: r.metadata,
      ip: r.ip,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }
}

export const auditLogService = new AuditLogService();
