import React, { useEffect } from "react";

// We import from the shared store that the main app uses.
// When bundled in library mode this becomes part of the package.
import { useApiConfigStore } from "../../../apps/frontend/src/store/apiConfigStore";
import { API_BASE_URL } from "../../../apps/frontend/src/lib/api";

export interface ApiProviderProps {
  /**
   * Bearer token — either the master API_TOKEN or a JWT obtained from
   * POST /api/auth/login. The host app is responsible for securely
   * fetching this from its own backend.
   */
  token: string;
  /**
   * Base URL of the ZuzuFlow backend API.
   * Example: "https://app.zuzuflow.com/api"
   * If omitted, uses the build-time VITE_API_URL or defaults to "/api".
   */
  apiUrl?: string;
  children: React.ReactNode;
}

/**
 * ApiProvider wires the token and optional API URL into the in-memory store
 * so all API calls made by child components are automatically authenticated.
 *
 * Usage:
 *   <ApiProvider token={jwt} apiUrl="https://app.zuzuflow.com/api">
 *     <WorkflowApp />
 *   </ApiProvider>
 */
export function ApiProvider({ token, apiUrl, children }: ApiProviderProps): React.ReactElement {
  const setToken = useApiConfigStore((s: { setToken: (token: string) => void }) => s.setToken);

  useEffect(() => {
    setToken(token);
  }, [token, setToken]);

  // If apiUrl is provided, override the global API_BASE_URL at module level.
  // This is a simple approach that works for single-instance usage.
  useEffect(() => {
    if (apiUrl) {
      (globalThis as any).__ZUZUFLOW_API_URL__ = apiUrl;
    }
    return () => {
      delete (globalThis as any).__ZUZUFLOW_API_URL__;
    };
  }, [apiUrl]);

  return <>{children}</>;
}
