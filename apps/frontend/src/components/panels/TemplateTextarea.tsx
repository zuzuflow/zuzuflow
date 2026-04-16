import React from "react";
import { useTemplateAutocomplete } from "../../hooks/useTemplateAutocomplete";
import { TemplateDropdown } from "./TemplateDropdown";

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
 * Drop-in replacement for <textarea> that shows {{ autocomplete.
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
        className={className}
      />
      {ac.isOpen && (
        <TemplateDropdown {...ac.dropdownProps} />
      )}
    </div>
  );
}
