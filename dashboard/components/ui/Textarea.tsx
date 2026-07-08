import type { Ref, TextareaHTMLAttributes } from "react";

export function Textarea({
  label,
  id,
  className = "",
  ref,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; ref?: Ref<HTMLTextAreaElement> }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        className={`rounded-sm border border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary bg-white focus:outline-none focus:shadow-focus focus:border-navy-600 ${className}`}
        {...props}
      />
    </div>
  );
}
