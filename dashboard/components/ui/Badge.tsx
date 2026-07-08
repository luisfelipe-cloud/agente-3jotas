import type { ReactNode } from "react";

type Variant = "success" | "progress" | "warning" | "error" | "neutral";
type Size = "sm" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  success: "bg-[#E7F5EE] text-success",
  progress: "bg-navy-50 text-navy-600",
  warning: "bg-[#FFF4E5] text-warning",
  error: "bg-[#FDEAEA] text-error",
  neutral: "bg-gray-50 text-gray-500",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-2.5 py-0.5 text-xs font-medium",
  lg: "px-3.5 py-1 text-lg font-extrabold",
};

export function Badge({
  variant = "neutral",
  size = "sm",
  children,
}: {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}) {
  return (
    <span className={`inline-flex items-center rounded-full ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]}`}>{children}</span>
  );
}
