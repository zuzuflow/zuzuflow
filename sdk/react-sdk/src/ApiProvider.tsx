import React, { useEffect } from "react";

import { useApiConfigStore } from "../../../apps/frontend/src/store/apiConfigStore";
import { useEnvironmentStore } from "../../../apps/frontend/src/store/environmentStore";

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
  /**
   * Environment slug to scope all API calls to (workflows, credentials,
   * variables, executions, logs). Required for the WorkflowDesigner +
   * WorkflowLogs screens — they refuse to load data without one.
   *
   * Pass the slug your backend assigned the environment, e.g. "production"
   * or "staging-acme". The host app is responsible for picking which
   * environment the embedded screen should target.
   */
  envSlug?: string;
  children: React.ReactNode;
}

/**
 * ApiProvider wires the bearer token + (optional) API URL + (optional)
 * environment slug into the SDK's in-memory stores so all API calls made by
 * embedded components are automatically authenticated and scoped.
 *
 * Usage:
 *   <ApiProvider
 *     token={jwt}
 *     apiUrl="https://app.zuzuflow.com/api"
 *     envSlug="production"
 *   >
 *     <WorkflowDesigner workflowId="abc" />
 *   </ApiProvider>
 */
export function ApiProvider({
  token,
  apiUrl,
  envSlug,
  children,
}: ApiProviderProps): React.ReactElement {
  const setToken = useApiConfigStore(
    (s: { setToken: (token: string) => void }) => s.setToken,
  );
  const setCurrentSlug = useEnvironmentStore((s) => s.setCurrentSlug);

  useEffect(() => {
    setToken(token);
  }, [token, setToken]);

  // If apiUrl is provided, override the global API_BASE_URL at module level.
  // Single-instance assumption — fine for embedded usage.
  useEffect(() => {
    if (apiUrl) {
      (globalThis as unknown as { __ZUZUFLOW_API_URL__?: string }).__ZUZUFLOW_API_URL__ =
        apiUrl;
    }
    return () => {
      delete (globalThis as unknown as { __ZUZUFLOW_API_URL__?: string }).__ZUZUFLOW_API_URL__;
    };
  }, [apiUrl]);

  // Plumb the environment slug into the env store so api.ts attaches it as
  // a header on every request. The host app picks which env the embedded
  // screen targets — no env-picker UI ships in the SDK.
  useEffect(() => {
    if (envSlug) setCurrentSlug(envSlug);
  }, [envSlug, setCurrentSlug]);

  return <>{children}</>;
}
