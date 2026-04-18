import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Building2, Loader2, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Logo } from "@/components/branding/Logo";
import { listMyOrganizations, switchOrganization } from "@/lib/api";
import { useOrgStore } from "@/store/orgStore";
import { useApiConfigStore } from "@/store/apiConfigStore";
import { spring } from "@/lib/motion";
import type { OrgItem } from "@/store/orgStore";

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  admin: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  editor: "bg-green-500/15 text-green-400 border-green-500/30",
  viewer: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

function getRoleBadgeClass(role: string): string {
  return ROLE_COLORS[role] ?? "bg-gray-500/15 text-gray-400 border-gray-500/30";
}

export function OrgPickerPage(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const setCurrentOrgId = useOrgStore((s) => s.setCurrentOrgId);
  const setOrganizations = useOrgStore((s) => s.setOrganizations);
  const setToken = useApiConfigStore((s) => s.setToken);

  useEffect(() => {
    // Try to get orgs from route state first
    const stateOrgs = (location.state as { organizations?: OrgItem[] })
      ?.organizations;
    if (stateOrgs && stateOrgs.length > 0) {
      setOrgs(stateOrgs);
      setOrganizations(stateOrgs);
      setLoading(false);
      return;
    }
    // Fallback: fetch from API
    listMyOrganizations()
      .then((result) => {
        setOrgs(result);
        setOrganizations(result);
      })
      .catch((err) =>
        setError((err as Error).message || "Failed to load organizations"),
      )
      .finally(() => setLoading(false));
  }, [location.state, setOrganizations]);

  const handleSelect = async (orgId: string) => {
    setSwitchingId(orgId);
    setError("");
    try {
      const result = await switchOrganization(orgId);
      setToken(result.token);
      setCurrentOrgId(orgId);
      if ("mfaEnrollmentRequired" in result) {
        navigate("/mfa-setup", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      setError((err as Error).message || "Failed to switch organization");
      setSwitchingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={spring.gentle}
        className="w-full max-w-md"
      >
        <div className="flex justify-center mb-8">
          <Logo size="md" />
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-border">
            <h1 className="text-base font-semibold text-foreground">
              Choose an organization
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Select which organization to work in
            </p>
          </div>

          <div className="px-4 py-4 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2
                  size={20}
                  className="animate-spin text-muted-foreground"
                />
              </div>
            ) : orgs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No organizations found.
              </p>
            ) : (
              orgs.map((org, index) => (
                <motion.button
                  key={org.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring.gentle, delay: index * 0.05 }}
                  onClick={() => handleSelect(org.id)}
                  disabled={switchingId !== null}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-border bg-background hover:bg-accent hover:border-primary/30 transition-colors text-left group disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Building2 size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {org.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {org.slug}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${getRoleBadgeClass(org.role)}`}
                  >
                    {org.role}
                  </span>
                  {switchingId === org.id ? (
                    <Loader2
                      size={14}
                      className="animate-spin text-muted-foreground shrink-0"
                    />
                  ) : (
                    <ChevronRight
                      size={14}
                      className="text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  )}
                </motion.button>
              ))
            )}
          </div>

          {error && (
            <div className="px-6 pb-4">
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
