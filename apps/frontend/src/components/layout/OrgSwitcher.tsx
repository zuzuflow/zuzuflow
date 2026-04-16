import { useState, useRef, useEffect } from "react";
import { ChevronDown, Building2, Check, Loader2 } from "lucide-react";
import { useOrgStore } from "@/store/orgStore";
import { useEnvironmentStore } from "@/store/environmentStore";
import { switchOrganization } from "@/lib/api";
import { useApiConfigStore } from "@/store/apiConfigStore";
import { cn } from "@/lib/utils";

interface Props {
  expanded: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-500/15 text-amber-400",
  admin: "bg-blue-500/15 text-blue-400",
  editor: "bg-green-500/15 text-green-400",
  viewer: "bg-gray-500/15 text-gray-400",
};

function getRoleBadgeClass(role: string): string {
  return ROLE_COLORS[role] ?? "bg-gray-500/15 text-gray-400";
}

export function OrgSwitcher({ expanded }: Props) {
  const [open, setOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const organizations = useOrgStore((s) => s.organizations);
  const currentOrgId = useOrgStore((s) => s.currentOrgId);
  const setCurrentOrgId = useOrgStore((s) => s.setCurrentOrgId);
  const setToken = useApiConfigStore((s) => s.setToken);

  const current = organizations.find((o) => o.id === currentOrgId);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (organizations.length === 0) return null;

  const handleSwitch = async (orgId: string) => {
    if (orgId === currentOrgId) {
      setOpen(false);
      return;
    }
    setSwitchingId(orgId);
    try {
      const newToken = await switchOrganization(orgId);
      setToken(newToken);
      setCurrentOrgId(orgId);
      // Clear environment state so it reloads for new org
      useEnvironmentStore.getState().clear();
      // Notify the app that organization changed
      window.dispatchEvent(new CustomEvent("organization-changed", { detail: { orgId } }));
      setOpen(false);
    } catch {
      // Silently fail — user stays on current org
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <div ref={ref} className="relative px-2 py-1.5">
      <button
        onClick={() => setOpen(!open)}
        title={!expanded ? `Organization: ${current?.name ?? "Unknown"}` : undefined}
        className={cn(
          "flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm transition-colors",
          "hover:bg-accent text-foreground"
        )}
      >
        <Building2 size={14} className="shrink-0 text-primary" />
        {expanded ? (
          <>
            <span className="truncate flex-1 text-left text-xs font-medium">{current?.name ?? "Select Org"}</span>
            <ChevronDown size={12} className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
          </>
        ) : null}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[200px]",
            expanded ? "left-2 right-2 top-full mt-1" : "left-full ml-2 top-0"
          )}
        >
          <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            Organizations
          </div>
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => handleSwitch(org.id)}
              disabled={switchingId !== null}
              className={cn(
                "flex items-center gap-2 w-full px-2 py-1.5 text-xs transition-colors hover:bg-accent rounded-md mx-0.5 disabled:opacity-50",
                org.id === currentOrgId ? "text-primary font-medium" : "text-foreground"
              )}
            >
              <Building2 size={12} className="shrink-0 text-muted-foreground" />
              <span className="flex-1 text-left truncate">{org.name}</span>
              <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full", getRoleBadgeClass(org.role))}>
                {org.role}
              </span>
              {switchingId === org.id ? (
                <Loader2 size={12} className="animate-spin shrink-0 text-muted-foreground" />
              ) : org.id === currentOrgId ? (
                <Check size={12} className="shrink-0 text-primary" />
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
