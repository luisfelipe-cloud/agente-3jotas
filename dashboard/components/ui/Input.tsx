import type { InputHTMLAttributes, ReactNode } from "react";

export function Input({
  label,
  error,
  id,
  className = "",
  labelClassName = "",
  icon,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  labelClassName?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className={`text-sm font-medium text-text-primary ${labelClassName}`}>
          {label}
        </label>
      )}
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-600">{icon}</span>}
        <input
          id={id}
          className={`h-10 w-full rounded-sm border px-3 text-sm text-text-primary placeholder:text-text-secondary bg-white focus:outline-none focus:shadow-focus focus:border-navy-600 ${
            icon ? "pl-9" : ""
          } ${error ? "border-error" : "border-border"} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
