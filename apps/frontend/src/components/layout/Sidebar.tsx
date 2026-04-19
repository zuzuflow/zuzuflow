import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  KeyRound,
  Activity,
  Settings,
  Sun,
  Moon,
  LogOut,
  Command,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  Workflow,
} from "lucide-react";
import { Logo } from "@/components/branding/Logo";
import { OrgSwitcher } from "@/components/layout/OrgSwitcher";
import { useTheme } from "@/components/theme-provider";
import { useApiConfigStore } from "@/store/apiConfigStore";
import { useEnvironmentStore } from "@/store/environmentStore";
import { useOrgStore } from "@/store/orgStore";
import { listEnvironments, listMyOrganizations } from "@/lib/api";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/workflows", icon: Workflow, label: "Workflows" },
  { to: "/logs", icon: Activity, label: "Logs" },
  { to: "/credentials", icon: KeyRound, label: "Credentials" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

interface SidebarProps {
  onOpenCommandPalette?: () => void;
}

export function Sidebar({ onOpenCommandPalette }: SidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const { theme, setTheme } = useTheme();
  const clearAuth = useApiConfigStore((s) => s.clearAuth);
  const isAuthenticated = useApiConfigStore((s) => s.isAuthenticated);
  const setEnvironments = useEnvironmentStore((s) => s.setEnvironments);
  const envLoaded = useEnvironmentStore((s) => s.loaded);
  const setOrganizations = useOrgStore((s) => s.setOrganizations);
  const orgLoaded = useOrgStore((s) => s.loaded);
  const navigate = useNavigate();

  const isMac = navigator.platform.includes("Mac");

  // Load environments on mount (and when auth changes)
  useEffect(() => {
    if (!isAuthenticated) return;
    if (envLoaded) return;
    listEnvironments()
      .then((envs) => setEnvironments(envs))
      .catch(() => {
        // Fallback: if API doesn't support environments yet, create a mock default
        setEnvironments([{
          id: "env-default-production",
          name: "Production",
          slug: "production",
          isDefault: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }]);
      });
  }, [isAuthenticated, envLoaded, setEnvironments]);

  // Load organizations on mount (and when auth changes)
  useEffect(() => {
    if (!isAuthenticated) return;
    if (orgLoaded) return;
    listMyOrganizations()
      .then((orgs) => setOrganizations(orgs))
      .catch(() => {
        // Silently fail — org switcher will just be empty
      });
  }, [isAuthenticated, orgLoaded, setOrganizations]);

  return (
    <aside
      style={{ width: expanded ? 200 : 52 }}
      className="h-full bg-card border-r border-border flex flex-col shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out"
    >
      {/* Logo row */}
      <div className="h-12 flex items-center border-b border-border shrink-0 px-3">
        {expanded ? (
          <div className="flex items-center w-full">
            <Logo size="sm" showText />
            <button
              onClick={() => setExpanded(false)}
              title="Collapse"
              className="ml-auto p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <ChevronsLeft size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setExpanded(true)}
            title="Expand"
            className="mx-auto p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ChevronsRight size={14} />
          </button>
        )}
      </div>

      {/* Org switcher */}
      <OrgSwitcher expanded={expanded} />

      {/* Nav links */}
      <nav className="flex-1 py-2 px-2 flex flex-col gap-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            title={!expanded ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                "flex flex-row items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap overflow-hidden",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )
            }
          >
            <item.icon size={17} className="shrink-0" />
            {expanded && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="px-2 pb-3 pt-2 flex flex-col gap-0.5 border-t border-border">
        {/* Command palette */}
        <button
          onClick={onOpenCommandPalette}
          title={!expanded ? "Search" : undefined}
          className="flex flex-row items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors whitespace-nowrap overflow-hidden w-full"
        >
          <Command size={17} className="shrink-0" />
          {expanded && (
            <span className="flex items-center gap-2 truncate">
              Search
              <kbd className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono leading-none">
                {isMac ? "⌘" : "Ctrl"}K
              </kbd>
            </span>
          )}
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={!expanded ? "Toggle theme" : undefined}
          className="flex flex-row items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors whitespace-nowrap overflow-hidden w-full"
        >
          {theme === "dark"
            ? <Sun size={17} className="shrink-0" />
            : <Moon size={17} className="shrink-0" />}
          {expanded && (
            <span className="truncate">
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </span>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={() => { clearAuth(); useEnvironmentStore.getState().clear(); useOrgStore.getState().clear(); navigate("/login"); }}
          title={!expanded ? "Logout" : undefined}
          className="flex flex-row items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:text-red-400 hover:bg-red-900/20 transition-colors whitespace-nowrap overflow-hidden w-full"
        >
          <LogOut size={17} className="shrink-0" />
          {expanded && <span className="truncate">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
