import React from "react";
import { cn } from "../../lib/utils";
import { useTemplateAutocomplete } from "../../hooks/useTemplateAutocomplete";
import { TemplateDropdown } from "./TemplateDropdown";

const DEFAULT_INPUT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

type BaseInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
>;

interface TemplateInputProps extends BaseInputProps {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  /** Class applied to the wrapper div (defaults to "relative w-full") */
  wrapperClassName?: string;
  /** Optional content rendered absolutely inside the wrapper (e.g. a Show/Hide button) */
  endAdornment?: React.ReactNode;
}

/**
 * Drop-in replacement for <input type="text"> that shows {{ autocomplete.
 */
export function TemplateInput({
  value,
  onChange,
  className,
  wrapperClassName = "relative w-full",
  endAdornment,
  ...rest
}: TemplateInputProps): React.ReactElement {
  const ac = useTemplateAutocomplete(value, onChange);

  return (
    <div className={wrapperClassName}>
      <input
        {...rest}
        {...ac.inputProps}
        value={value}
        className={cn(DEFAULT_INPUT_CLASS, className)}
      />
      {endAdornment}
      {ac.isOpen && (
        <TemplateDropdown {...ac.dropdownProps} />
      )}
    </div>
  );
}
