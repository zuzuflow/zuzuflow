import { useState, useRef, useEffect } from "react";
import { ChevronDown, Globe, Check } from "lucide-react";
import { useEnvironmentStore } from "@/store/environmentStore";
import { cn } from "@/lib/utils";

interface Props {
  expanded: boolean;
}

const ENV_COLORS: Record<string, string> = {
  production: "bg-green-500",
  staging: "bg-yellow-500",
  development: "bg-blue-500",
  dev: "bg-blue-500",
  test: "bg-purple-500",
};

function getEnvColor(slug: string): string {
  return ENV_COLORS[slug] ?? "bg-indigo-500";
}

export function EnvironmentSwitcher({ expanded }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const environments = useEnvironmentStore((s) => s.environments);
  const currentSlug = useEnvironmentStore((s) => s.currentSlug);
  const setCurrentSlug = useEnvironmentStore((s) => s.setCurrentSlug);

  const current = environments.find((e) => e.slug === currentSlug);

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

  if (environments.length === 0) return null;

  return (
    <div ref={ref} className="relative px-2 py-1.5">
      <button
        onClick={() => setOpen(!open)}
        title={!expanded ? `Environment: ${current?.name ?? "Unknown"}` : undefined}
        className={cn(
          "flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm transition-colors",
          "hover:bg-accent text-foreground"
        )}
      >
        <span className={cn("w-2 h-2 rounded-full shrink-0", getEnvColor(currentSlug ?? ""))} />
        {expanded ? (
          <>
            <span className="truncate flex-1 text-left text-xs font-medium">{current?.name ?? "Select Env"}</span>
            <ChevronDown size={12} className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
          </>
        ) : (
          <Globe size={14} className="shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[180px]",
            expanded ? "left-2 right-2 top-full mt-1" : "left-full ml-2 top-0"
          )}
        >
          <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            Environments
          </div>
          {environments.map((env) => (
            <button
              key={env.id}
              onClick={() => {
                setCurrentSlug(env.slug);
                setOpen(false);
                // Trigger page refresh by dispatching a custom event
                window.dispatchEvent(new CustomEvent("environment-changed", { detail: { slug: env.slug } }));
              }}
              className={cn(
                "flex items-center gap-2 w-full px-2 py-1.5 text-xs transition-colors hover:bg-accent rounded-md mx-0.5",
                env.slug === currentSlug ? "text-primary font-medium" : "text-foreground"
              )}
            >
              <span className={cn("w-2 h-2 rounded-full shrink-0", getEnvColor(env.slug))} />
              <span className="flex-1 text-left truncate">{env.name}</span>
              {env.slug === currentSlug && <Check size={12} className="shrink-0 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
