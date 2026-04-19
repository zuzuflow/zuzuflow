import { useEffect, useState } from "react";
import { getSignupStatus } from "@/lib/api";

// Module-scoped cache — signup status rarely changes and is the same for every
// page that checks it. One fetch per tab, shared across all subscribers.
let cache: { enabled: boolean } | null = null;
let inflight: Promise<{ enabled: boolean }> | null = null;

/**
 * Hook for checking whether public signup is enabled. Fails open (assumes
 * enabled) if the probe fails — matches the historical behavior where every
 * install had signup on.
 */
export function useSignupStatus(): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = useState<boolean>(cache?.enabled ?? true);
  const [loading, setLoading] = useState<boolean>(cache === null);

  useEffect(() => {
    if (cache !== null) return;
    if (!inflight) {
      inflight = getSignupStatus()
        .then((res) => {
          cache = res;
          return res;
        })
        .catch(() => {
          cache = { enabled: true };
          return cache;
        });
    }
    inflight.then((res) => {
      setEnabled(res.enabled);
      setLoading(false);
    });
  }, []);

  return { enabled, loading };
}
