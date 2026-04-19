import { useCallback, useEffect, useState } from "react";
import {
  listCustomNodeTemplates,
  type CustomNodeTemplateRecord,
} from "../lib/api";

export interface UseCustomNodeTemplatesResult {
  templates: CustomNodeTemplateRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches the org's custom node template library (own templates + any public
 * templates shared by other orgs on this instance). Used by the "Custom Nodes"
 * palette section and the builder modal.
 */
export function useCustomNodeTemplates(): UseCustomNodeTemplatesResult {
  const [templates, setTemplates] = useState<CustomNodeTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCustomNodeTemplates();
      setTemplates(res.items);
    } catch (err) {
      setError((err as Error).message ?? "Failed to load custom node templates");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Cross-component refresh hook: builder modal dispatches this after saving.
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("custom-node-template-saved", handler);
    return () =>
      window.removeEventListener("custom-node-template-saved", handler);
  }, [refresh]);

  return { templates, loading, error, refresh };
}
