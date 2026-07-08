import type { HTMLAttributes } from "react";

type Variant = "border" | "elevated";

const VARIANT_CLASSES: Record<Variant, string> = {
  border: "border border-border shadow-none",
  elevated: "border border-transparent shadow-sm",
};

export function Card({
  className = "",
  variant = "border",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  return (
    <div
      className={`rounded-lg bg-surface p-5 sm:p-6 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
