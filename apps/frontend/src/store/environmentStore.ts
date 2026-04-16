import { create } from "zustand";
import { persist } from "zustand/middleware";

// =============================================================================
// environmentStore — tracks which environment the user is currently working in.
//
// Persisted to localStorage. On login, the app fetches environments from the
// API and auto-selects the default (or last-used) environment.
// =============================================================================

export interface EnvironmentItem {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EnvironmentState {
  /** All environments the user has access to */
  environments: EnvironmentItem[];
  /** Slug of the currently active environment */
  currentSlug: string | null;
  /** Whether environments have been loaded from the API */
  loaded: boolean;

  setEnvironments: (envs: EnvironmentItem[]) => void;
  setCurrentSlug: (slug: string) => void;
  clear: () => void;
}

export const useEnvironmentStore = create<EnvironmentState>()(
  persist(
    (set, get) => ({
      environments: [],
      currentSlug: null,
      loaded: false,

      setEnvironments: (envs) => {
        const current = get().currentSlug;
        // Auto-select: keep current if it's still valid, else pick default, else first
        const validSlugs = envs.map((e) => e.slug);
        let slug = current && validSlugs.includes(current) ? current : null;
        if (!slug) {
          const def = envs.find((e) => e.isDefault);
          slug = def?.slug ?? envs[0]?.slug ?? null;
        }
        set({ environments: envs, currentSlug: slug, loaded: true });
      },

      setCurrentSlug: (slug) => set({ currentSlug: slug }),
      clear: () => set({ environments: [], currentSlug: null, loaded: false }),
    }),
    {
      name: "wf-env",
      partialize: (state) => ({ currentSlug: state.currentSlug }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Mark as not loaded — environments list needs to be fetched from API
          state.loaded = false;
        }
      },
    }
  )
);

// Non-hook accessor for use inside api.ts
export const getEnvironmentState = () => useEnvironmentStore.getState();
