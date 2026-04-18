import { create } from "zustand";
import { persist } from "zustand/middleware";

// =============================================================================
// orgStore — tracks the user's organizations and currently selected org.
//
// Persisted to localStorage. On login, the app receives organizations from the
// API and auto-selects the current (or last-used) organization.
// =============================================================================

export interface OrgItem {
  id: string;
  name: string;
  slug: string;
  role: string;
  mfaEnforced?: boolean;
  createdAt: string;
}

interface OrgState {
  /** All organizations the user belongs to */
  organizations: OrgItem[];
  /** ID of the currently active organization */
  currentOrgId: string | null;
  /** Whether organizations have been loaded from the API */
  loaded: boolean;

  setOrganizations: (orgs: OrgItem[]) => void;
  setCurrentOrgId: (id: string) => void;
  clear: () => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      organizations: [],
      currentOrgId: null,
      loaded: false,

      setOrganizations: (orgs) => {
        const current = get().currentOrgId;
        // Auto-select: keep current if it's still valid, else pick first
        const validIds = orgs.map((o) => o.id);
        let id = current && validIds.includes(current) ? current : null;
        if (!id) {
          id = orgs[0]?.id ?? null;
        }
        set({ organizations: orgs, currentOrgId: id, loaded: true });
      },

      setCurrentOrgId: (id) => set({ currentOrgId: id }),
      clear: () =>
        set({ organizations: [], currentOrgId: null, loaded: false }),
    }),
    {
      name: "wf-org",
      partialize: (state) => ({ currentOrgId: state.currentOrgId }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Mark as not loaded — organizations list needs to be fetched from API
          state.loaded = false;
        }
      },
    },
  ),
);

// Non-hook accessor for use inside api.ts (outside React components)
export const getOrgState = () => useOrgStore.getState();
