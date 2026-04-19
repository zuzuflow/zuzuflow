import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useEnvironmentStore } from "@/store/environmentStore";
import { cn } from "@/lib/utils";
import { InviteBell } from "./InviteBell";

// ─── Color mapping for environment badges ────────────────────────────────────

const ENV_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  production: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-500", border: "border-red-500/30" },
  staging: { bg: "bg-yellow-500/10", text: "text-yellow-400", dot: "bg-yellow-500", border: "border-yellow-500/30" },
  development: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-500", border: "border-blue-500/30" },
  dev: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-500", border: "border-blue-500/30" },
  test: { bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-500", border: "border-purple-500/30" },
};

function getEnvTheme(slug: string) {
  return ENV_COLORS[slug] ?? { bg: "bg-indigo-500/10", text: "text-indigo-400", dot: "bg-indigo-500", border: "border-indigo-500/30" };
}

// ─── Top Navigation Bar ──────────────────────────────────────────────────────

export function TopNav() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const environments = useEnvironmentStore((s) => s.environments);
  const currentSlug = useEnvironmentStore((s) => s.currentSlug);
  const setCurrentSlug = useEnvironmentStore((s) => s.setCurrentSlug);

  const current = environments.find((e) => e.slug === currentSlug);
  const theme = getEnvTheme(currentSlug ?? "");

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (environments.length === 0) return null;

  return (
    /* `relative z-40` creates a stacking context so the env-switcher dropdown
       (z-50 inside here) paints above <main>, which is a later sibling and
       would otherwise overlap it at the default stacking order. */
    <div className="relative z-40 h-10 border-b border-border bg-card/50 backdrop-blur-sm flex items-center px-4 shrink-0 gap-2">
      {/* Pending-invite bell — only meaningful for authed users */}
      <div className="ml-auto">
        <InviteBell />
      </div>

      {/* Environment switcher — AWS-style role badge */}
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-all border",
            theme.bg, theme.text, theme.border,
            "hover:opacity-80"
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", theme.dot)} />
          <span>{current?.name ?? "Select Environment"}</span>
          <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[220px]">
            <div className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              Switch Environment
            </div>
            <div className="h-px bg-border mx-2 mb-1" />
            {environments.map((env) => {
              const envTheme = getEnvTheme(env.slug);
              const isActive = env.slug === currentSlug;
              return (
                <button
                  key={env.id}
                  onClick={() => {
                    setCurrentSlug(env.slug);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-2 text-xs transition-colors",
                    "hover:bg-accent/50",
                    isActive && "bg-accent/30"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full shrink-0", envTheme.dot)} />
                  <span className={cn("flex-1 text-left", isActive ? "text-foreground font-medium" : "text-muted-foreground")}>
                    {env.name}
                  </span>
                  {env.isDefault && (
                    <span className="text-[10px] text-muted-foreground/60 font-medium">default</span>
                  )}
                  {isActive && <Check size={12} className="shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
