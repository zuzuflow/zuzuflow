import React from "react";
import { cn } from "../../lib/utils";
import { useTemplateAutocomplete } from "../../hooks/useTemplateAutocomplete";
import { TemplateDropdown } from "./TemplateDropdown";

// Mirrors DEFAULT_INPUT_CLASS in TemplateInput so a textarea looks like a
// vertically-grown sibling of the matching <Input>: same border, same focus
// ring, same monospace placeholder colour, same padding rhythm. Without
// these defaults the browser falls back to its native textarea (white box,
// system font, no focus ring) — which clashes badly with the dark form chrome.
const DEFAULT_TEXTAREA_CLASS =
  "flex w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y font-mono leading-relaxed";

type BaseTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
>;

interface TemplateTextareaProps extends BaseTextareaProps {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

/**
 * Drop-in replacement for <textarea> that shows {{ autocomplete and inherits
 * the form's design tokens. Pass `className` to extend / override the default
 * classes (merged via `cn()` so caller wins on conflicts).
 */
export function TemplateTextarea({
  value,
  onChange,
  className,
  ...rest
}: TemplateTextareaProps): React.ReactElement {
  const ac = useTemplateAutocomplete(value, onChange);

  return (
    <div className="relative w-full">
      <textarea
        {...rest}
        ref={ac.inputRef as React.RefObject<HTMLTextAreaElement>}
        value={value}
        onChange={ac.inputProps.onChange}
        onKeyDown={ac.inputProps.onKeyDown}
        onBlur={ac.inputProps.onBlur}
        className={cn(DEFAULT_TEXTAREA_CLASS, className)}
      />
      {ac.isOpen && <TemplateDropdown {...ac.dropdownProps} />}
    </div>
  );
}
