import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

export function StatCard({
  label,
  value,
  hint,
  trend,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: { value: number; label: string };
}) {
  return (
    <Card>
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-extrabold text-navy-900 mt-2">{value}</p>
      {trend && (
        <p className={`text-xs font-medium mt-1 ${trend.value >= 0 ? "text-success" : "text-error"}`}>
          {trend.value >= 0 ? "▲" : "▼"} {Math.abs(trend.value)}% {trend.label}
        </p>
      )}
      {hint && !trend && <p className="text-xs text-text-secondary mt-1">{hint}</p>}
    </Card>
  );
}
