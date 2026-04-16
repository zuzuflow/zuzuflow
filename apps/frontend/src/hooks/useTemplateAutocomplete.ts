import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkflowStore } from "../store/workflowStore";
import { listVariables } from "../lib/api";
import type { VariableItem } from "../lib/api";

// =============================================================================
// Template autocomplete hook
//
// Detects {{  in any input/textarea, shows a filtered suggestion list,
// and replaces the partial expression with the selected suggestion.
//
// Usage:
//   const ac = useTemplateAutocomplete(value, onChange);
//   return (
//     <div className="relative">
//       <input {...ac.inputProps} />
//       {ac.isOpen && <TemplateDropdown {...ac.dropdownProps} />}
//     </div>
//   );
// =============================================================================

// ─── Known output fields per node kind ───────────────────────────────────────

const NODE_OUTPUT_FIELDS: Record<string, string[]> = {
  http_request:   ["status", "statusText", "headers", "body", "data"],
  postgres_query: ["rows", "rowCount"],
  send_email:     ["messageId", "accepted", "rejected"],
  custom_code:    ["result"],
  webhook:        ["body", "headers", "query", "method", "params"],
  cron:           ["scheduledTime", "actualTime", "attempt"],
  manual:         [],
  mqtt_trigger:   ["topic", "payload", "qos"],
  rabbitmq:       ["operation", "message", "content", "fields", "properties", "acked", "published", "destination", "routingKey"],
  if_else:        [],
  switch:         [],
  delay:          [],
  merge:          [],
  debug:          [],
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TemplateSuggestion {
  /** What gets inserted between {{ and }} */
  value: string;
  /** Human-readable label shown in the dropdown */
  label: string;
  /** Secondary description (node kind, variable type, etc.) */
  description?: string;
  /** Visual group */
  group: "variable" | "node" | "special";
}

export interface TemplateDropdownProps {
  suggestions: TemplateSuggestion[];
  activeIndex: number;
  onSelect: (suggestion: TemplateSuggestion) => void;
  onClose: () => void;
}

// ─── Variable cache (shared across all instances) ─────────────────────────────

let variableCache: VariableItem[] = [];
let variableFetched = false;

async function fetchVariables(): Promise<VariableItem[]> {
  if (variableFetched) return variableCache;
  try {
    variableCache = await listVariables();
    variableFetched = true;
  } catch {
    variableCache = [];
  }
  return variableCache;
}

// Invalidate when the page gains focus (user might have added variables)
if (typeof window !== "undefined") {
  window.addEventListener("focus", () => { variableFetched = false; });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTemplateAutocomplete(
  value: string,
  onChange: (v: string) => void
) {
  const nodes = useWorkflowStore((s) => s.nodes);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [variables, setVariables] = useState<VariableItem[]>(variableCache);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  // Partial text typed after {{ at the cursor position
  const partialRef = useRef<string>("");

  // Load variables on mount (non-blocking)
  useEffect(() => {
    fetchVariables().then(setVariables);
  }, []);

  // ── Build full suggestion list ─────────────────────────────────────────────

  const allSuggestions = useMemo<TemplateSuggestion[]>(() => {
    const list: TemplateSuggestion[] = [];

    // 1. Special: input
    list.push({
      value: "input",
      label: "input",
      description: "trigger payload",
      group: "special",
    });

    // 2. Environment variables
    variables.forEach((v) => {
      list.push({
        value: `$env.${v.key}`,
        label: `$env.${v.key}`,
        description: v.description ?? (v.isSecret ? "secret" : "variable"),
        group: "variable",
      });
    });

    // 3. Nodes (current workflow)
    nodes.forEach((node) => {
      const nd = node.data as { kind: string; label: string };
      const fields = NODE_OUTPUT_FIELDS[nd.kind] ?? [];
      // The node itself (full output)
      list.push({
        value: node.id,
        label: nd.label || node.id.slice(0, 8),
        description: nd.kind,
        group: "node",
      });
      // Known sub-fields
      fields.forEach((field) => {
        list.push({
          value: `${node.id}.${field}`,
          label: `${nd.label || node.id.slice(0, 8)}.${field}`,
          description: nd.kind,
          group: "node",
        });
      });
    });

    return list;
  }, [nodes, variables]);

  // ── Filter suggestions by partial ─────────────────────────────────────────

  const suggestions = useMemo<TemplateSuggestion[]>(() => {
    const partial = partialRef.current.toLowerCase();
    if (!partial) return allSuggestions.slice(0, 20);
    return allSuggestions
      .filter((s) =>
        s.value.toLowerCase().includes(partial) ||
        s.label.toLowerCase().includes(partial)
      )
      .slice(0, 20);
  }, [allSuggestions, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Detect {{ at cursor and extract partial ────────────────────────────────

  const detectPartial = useCallback(
    (val: string, cursorPos: number): string | null => {
      const before = val.slice(0, cursorPos);
      // Find the last {{ that hasn't been closed with }}
      const match = before.match(/\{\{([^}]*)$/);
      if (!match) return null;
      return match[1]; // text typed after {{
    },
    []
  );

  // ── Insert selected suggestion ─────────────────────────────────────────────

  const insertSuggestion = useCallback(
    (suggestion: TemplateSuggestion) => {
      const el = inputRef.current;
      if (!el) return;

      const cursorPos = el.selectionStart ?? value.length;
      const before = value.slice(0, cursorPos);
      const after = value.slice(cursorPos);

      // Replace {{ + partial with {{ + suggestion + }}
      const newBefore = before.replace(/\{\{([^}]*)$/, `{{${suggestion.value}}}`);
      const newValue = newBefore + after;

      onChange(newValue);
      setIsOpen(false);

      // Restore cursor after the inserted expression
      requestAnimationFrame(() => {
        if (!el) return;
        const newPos = newBefore.length;
        el.setSelectionRange(newPos, newPos);
        el.focus();
      });
    },
    [value, onChange]
  );

  // ── Input event handlers ───────────────────────────────────────────────────

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newVal = e.target.value;
      const cursor = e.target.selectionStart ?? newVal.length;
      onChange(newVal);

      const partial = detectPartial(newVal, cursor);
      if (partial !== null) {
        partialRef.current = partial;
        setIsOpen(true);
        setActiveIndex(0);
      } else {
        setIsOpen(false);
      }
    },
    [onChange, detectPartial]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (suggestions[activeIndex]) {
          e.preventDefault();
          insertSuggestion(suggestions[activeIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
      }
    },
    [isOpen, suggestions, activeIndex, insertSuggestion]
  );

  const handleBlur = useCallback(() => {
    // Delay so click on dropdown item fires first
    setTimeout(() => setIsOpen(false), 150);
  }, []);

  // ── Re-compute filtered list when partial changes ──────────────────────────

  const updatePartialAndFilter = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // handled in handleChange above
      handleChange(e);
    },
    [handleChange]
  );

  return {
    isOpen,
    suggestions,
    activeIndex,
    inputRef,
    inputProps: {
      ref: inputRef as React.RefObject<any>,
      onChange: updatePartialAndFilter,
      onKeyDown: handleKeyDown,
      onBlur: handleBlur,
    },
    dropdownProps: {
      suggestions,
      activeIndex,
      onSelect: insertSuggestion,
      onClose: () => setIsOpen(false),
    } satisfies TemplateDropdownProps,
  };
}
