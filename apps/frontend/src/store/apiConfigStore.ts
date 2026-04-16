import { create } from "zustand";
import { persist } from "zustand/middleware";

// =============================================================================
// apiConfigStore — holds auth token, persisted to localStorage.
//
// The token survives page refreshes. clearAuth() wipes it (logout).
// The API URL is fixed at build time via VITE_API_URL (defaults to /api).
// =============================================================================

interface ApiConfigState {
  /** Bearer token — JWT or master API token. Null = not authenticated. */
  token: string | null;
  /** Currently selected organization ID. Null = none selected. */
  organizationId: string | null;
  /** Convenience flag — true when token is set */
  isAuthenticated: boolean;

  setToken: (token: string, organizationId?: string) => void;
  setOrganizationId: (id: string | null) => void;
  clearAuth: () => void;
}

export const useApiConfigStore = create<ApiConfigState>()(
  persist(
    (set) => ({
      token: null,
      organizationId: null,
      isAuthenticated: false,

      setToken: (token, organizationId) =>
        set((prev) => ({
          token,
          isAuthenticated: true,
          organizationId: organizationId ?? prev.organizationId,
        })),
      setOrganizationId: (id) => set({ organizationId: id }),
      clearAuth: () => set({ token: null, organizationId: null, isAuthenticated: false }),
    }),
    {
      name: "wf-auth",
      // Persist token and organizationId — rehydrate isAuthenticated from token
      partialize: (state) => ({ token: state.token, organizationId: state.organizationId }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isAuthenticated = !!state.token;
        }
      },
    }
  )
);

// Non-hook accessor for use inside api.ts (outside React components)
export const getApiConfig = () => useApiConfigStore.getState();
