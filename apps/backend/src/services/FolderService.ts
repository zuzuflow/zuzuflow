import { prisma } from "../db/client";

// =============================================================================
// FolderService — CRUD for workflow folders
// =============================================================================

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export class FolderService {
  async listFolders(environmentId: string): Promise<FolderItem[]> {
    const rows = await prisma.folder.findMany({ where: { environmentId }, orderBy: { name: "asc" } });
    return rows.map((f) => ({
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    }));
  }

  async createFolder(name: string, environmentId: string, parentId?: string): Promise<FolderItem> {
    if (!name.trim()) throw Object.assign(new Error("name is required"), { code: "VALIDATION_ERROR" });
    // Validate parent exists
    if (parentId) {
      const parent = await prisma.folder.findUnique({ where: { id: parentId } });
      if (!parent) throw Object.assign(new Error("Parent folder not found"), { code: "NOT_FOUND" });
    }
    const f = await prisma.folder.create({ data: { name: name.trim(), parentId: parentId ?? null, environmentId } });
    return { id: f.id, name: f.name, parentId: f.parentId, createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString() };
  }

  async renameFolder(id: string, name: string): Promise<FolderItem> {
    if (!name.trim()) throw Object.assign(new Error("name is required"), { code: "VALIDATION_ERROR" });
    const f = await prisma.folder.update({ where: { id }, data: { name: name.trim() } }).catch(() => {
      throw Object.assign(new Error("Folder not found"), { code: "NOT_FOUND" });
    });
    return { id: f.id, name: f.name, parentId: f.parentId, createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString() };
  }

  async moveFolder(id: string, parentId: string | null): Promise<FolderItem> {
    // Prevent cycles: parentId must not be id or a descendant
    if (parentId) {
      const descendants = await this._collectDescendantIds(id);
      if (parentId === id || descendants.has(parentId)) {
        throw Object.assign(new Error("Cannot move a folder into itself or a descendant"), { code: "VALIDATION_ERROR" });
      }
    }
    const f = await prisma.folder.update({ where: { id }, data: { parentId } }).catch(() => {
      throw Object.assign(new Error("Folder not found"), { code: "NOT_FOUND" });
    });
    return { id: f.id, name: f.name, parentId: f.parentId, createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString() };
  }

  /** Delete folder — moves its workflows and child folders to parent (or root). */
  async deleteFolder(id: string): Promise<void> {
    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder) throw Object.assign(new Error("Folder not found"), { code: "NOT_FOUND" });

    await prisma.$transaction([
      // Move workflows to parent
      prisma.workflow.updateMany({ where: { folderId: id }, data: { folderId: folder.parentId } }),
      // Move child folders to parent
      prisma.folder.updateMany({ where: { parentId: id }, data: { parentId: folder.parentId } }),
      // Delete the folder itself
      prisma.folder.delete({ where: { id } }),
    ]);
  }

  private async _collectDescendantIds(id: string): Promise<Set<string>> {
    const all = await prisma.folder.findMany({ select: { id: true, parentId: true } });
    const children = new Map<string, string[]>();
    for (const f of all) {
      if (f.parentId) {
        if (!children.has(f.parentId)) children.set(f.parentId, []);
        children.get(f.parentId)!.push(f.id);
      }
    }
    const result = new Set<string>();
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const child of children.get(cur) ?? []) {
        result.add(child);
        queue.push(child);
      }
    }
    return result;
  }
}

export const folderService = new FolderService();
