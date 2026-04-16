import React, { useEffect, useRef } from "react";
import type { TemplateDropdownProps, TemplateSuggestion } from "../../hooks/useTemplateAutocomplete";

const GROUP_LABELS: Record<TemplateSuggestion["group"], string> = {
  special: "Special",
  variable: "Environment Variables",
  node:    "Node Outputs",
};

const GROUP_ORDER: TemplateSuggestion["group"][] = ["special", "variable", "node"];

const GROUP_BADGE: Record<TemplateSuggestion["group"], string> = {
  special:  "bg-amber-900 text-amber-300",
  variable: "bg-emerald-900 text-emerald-300",
  node:     "bg-indigo-900 text-indigo-300",
};

export function TemplateDropdown({
  suggestions,
  activeIndex,
  onSelect,
  onClose,
}: TemplateDropdownProps): React.ReactElement | null {
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll active item into view
  useEffect(() => {
    const el = containerRef.current?.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (suggestions.length === 0) return null;

  // Group suggestions preserving order
  const grouped = GROUP_ORDER.reduce<Record<string, TemplateSuggestion[]>>((acc, g) => {
    const items = suggestions.filter((s) => s.group === g);
    if (items.length) acc[g] = items;
    return acc;
  }, {});

  return (
    <div
      ref={containerRef}
      className="absolute z-50 mt-1 w-full min-w-[220px] max-h-60 overflow-y-auto rounded-md border border-border bg-card shadow-xl text-xs"
      onMouseDown={(e) => e.preventDefault()} // prevent blur before click
    >
      <ul role="listbox">
        {GROUP_ORDER.map((group) => {
          const items = grouped[group];
          if (!items) return null;
          return (
            <li key={group}>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60">
                {GROUP_LABELS[group]}
              </div>
              <ul>
                {items.map((s) => {
                  const idx = suggestions.indexOf(s);
                  const isActive = idx === activeIndex;
                  return (
                    <li
                      key={s.value}
                      role="option"
                      aria-selected={isActive}
                      data-index={idx}
                      className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${
                        isActive
                          ? "bg-indigo-600 text-white"
                          : "text-foreground hover:bg-muted"
                      }`}
                      onMouseDown={() => onSelect(s)}
                    >
                      <span className="flex-1 font-mono truncate">{s.label}</span>
                      {s.description && (
                        <span
                          className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium ${
                            isActive ? "bg-indigo-500 text-white" : GROUP_BADGE[s.group]
                          }`}
                        >
                          {s.description}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
      <div className="px-3 py-1 border-t border-border text-[10px] text-muted-foreground flex gap-3">
        <span>↑↓ navigate</span>
        <span>⏎ select</span>
        <span>Esc close</span>
      </div>
    </div>
  );
}
