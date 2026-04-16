import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import * as api from "../../lib/api";

// Must stay in sync with MAX_TAGS_PER_WORKFLOW on the backend.
const MAX_TAGS = 16;
const MAX_TAG_LENGTH = 32;

/** Mirror the backend's normalizeTagName for an accurate preview. */
function normalize(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9\-_:]/g, "").slice(0, MAX_TAG_LENGTH);
}

export interface TagChipInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** Optional list of existing tags for typeahead; if omitted, fetched lazily. */
  suggestions?: api.Tag[];
  placeholder?: string;
  className?: string;
}

/**
 * Reusable chip editor for applying tags to a workflow. Fetches the env's tag
 * catalog once for typeahead; users can also type a new value and press Enter
 * to create one (actual persistence happens server-side on save).
 */
export function TagChipInput({
  value,
  onChange,
  suggestions: suggestionsProp,
  placeholder = "Add tag…",
  className,
}: TagChipInputProps) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [fetched, setFetched] = useState<api.Tag[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lazy-load the env tag list once when no suggestions were passed in
  useEffect(() => {
    if (suggestionsProp || fetched) return;
    api
      .listTags()
      .then(setFetched)
      .catch(() => setFetched([]));
  }, [suggestionsProp, fetched]);

  const suggestions = suggestionsProp ?? fetched ?? [];

  const filteredSuggestions = useMemo(() => {
    const normalizedInput = normalize(input);
    return suggestions
      .filter(
        (t) =>
          !value.includes(t.name) &&
          (normalizedInput === "" || t.name.includes(normalizedInput))
      )
      .slice(0, 8);
  }, [suggestions, value, input]);

  const addTag = (raw: string) => {
    const normalized = normalize(raw);
    if (!normalized) return;
    if (value.includes(normalized)) {
      setInput("");
      return;
    }
    if (value.length >= MAX_TAGS) return;
    onChange([...value, normalized]);
    setInput("");
  };

  const removeTag = (name: string) => {
    onChange(value.filter((t) => t !== name));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && input === "" && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  const showDropdown = focused && filteredSuggestions.length > 0;

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-within:ring-1 focus-within:ring-ring",
          value.length >= MAX_TAGS && "opacity-75"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              className="rounded-sm hover:bg-background/50"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Delay so a click on a suggestion can register first
            setTimeout(() => setFocused(false), 150);
            if (input.trim()) addTag(input);
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          disabled={value.length >= MAX_TAGS}
          className="min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
      </div>

      {showDropdown && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md">
          {filteredSuggestions.map((s) => (
            <button
              key={s.name}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addTag(s.name)}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span>{s.name}</span>
              <span className="text-xs text-muted-foreground">{s.count}</span>
            </button>
          ))}
        </div>
      )}

      <p className="mt-1 text-[10px] text-muted-foreground">
        {value.length}/{MAX_TAGS} tags
      </p>
    </div>
  );
}
