import { useState, useEffect, useRef, useMemo } from "react";
import {
  acquireTypeForPackage,
  PackageTypeResult,
  TypeDefinition,
} from "@/lib/typeAcquisition";

// =============================================================================
// usePackageTypes — reactive hook that acquires types as packages change
//
// Debounces input (500ms after user stops typing), fetches per-package type
// status, merges user-uploaded custom types, and provides combined
// TypeDefinition[] for the editor.
// =============================================================================

export interface UsePackageTypesResult {
  /** Per-package status (loading, loaded, no-types, not-found, private, error) */
  packageStatuses: Map<string, PackageTypeResult>;
  /** Combined type definitions ready for Monaco addExtraLib() */
  typeDefs: TypeDefinition[];
  /** Whether any package is currently being resolved */
  loading: boolean;
}

export function usePackageTypes(
  packages: string[],
  customTypeDefs?: Record<string, string>
): UsePackageTypesResult {
  const [packageStatuses, setPackageStatuses] = useState<Map<string, PackageTypeResult>>(new Map());
  const [fetchedDefs, setFetchedDefs] = useState<TypeDefinition[]>([]);
  const [loading, setLoading] = useState(false);

  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const nonEmpty = packages.filter((p) => p.trim());

    if (nonEmpty.length === 0) {
      setPackageStatuses(new Map());
      setFetchedDefs([]);
      setLoading(false);
      return;
    }

    // Set all current packages to "loading" immediately for UI feedback
    setLoading(true);
    setPackageStatuses((prev) => {
      const next = new Map(prev);
      for (const pkg of nonEmpty) {
        const trimmed = pkg.trim();
        if (!next.has(trimmed)) {
          next.set(trimmed, {
            packageName: trimmed,
            raw: trimmed,
            status: "loading",
            defs: [],
            message: "Resolving...",
          });
        }
      }
      for (const key of next.keys()) {
        if (!nonEmpty.some((p) => p.trim() === key)) {
          next.delete(key);
        }
      }
      return next;
    });

    // Debounce the actual fetch
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const id = ++requestIdRef.current;

      const results = await Promise.all(
        nonEmpty.map((raw) => acquireTypeForPackage(raw))
      );

      if (id !== requestIdRef.current) return;

      const statusMap = new Map<string, PackageTypeResult>();
      const allDefs: TypeDefinition[] = [];

      for (const result of results) {
        statusMap.set(result.raw.trim() || result.packageName, result);
        allDefs.push(...result.defs);
      }

      setPackageStatuses(statusMap);
      setFetchedDefs(allDefs);
      setLoading(false);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [packages.join("|")]);

  // Merge fetched types + custom uploaded types
  const typeDefs = useMemo(() => {
    const merged = [...fetchedDefs];

    if (customTypeDefs) {
      for (const [pkgName, content] of Object.entries(customTypeDefs)) {
        if (!content) continue;
        // Remove any fetched ambient fallback for this package and replace with custom
        const idx = merged.findIndex(
          (d) => d.filePath === `file:///node_modules/${pkgName}/index.d.ts`
        );
        const customDef: TypeDefinition = {
          filePath: `file:///node_modules/${pkgName}/index.d.ts`,
          content: ensureModuleDeclaration(pkgName, content),
        };
        if (idx >= 0) {
          merged[idx] = customDef;
        } else {
          merged.push(customDef);
        }
      }
    }

    return merged;
  }, [fetchedDefs, customTypeDefs]);

  return { packageStatuses, typeDefs, loading };
}

function ensureModuleDeclaration(packageName: string, content: string): string {
  if (content.includes(`declare module "${packageName}"`)) return content;
  if (content.includes(`declare module '${packageName}'`)) return content;
  return `declare module "${packageName}" {\n${content}\n}\n`;
}
