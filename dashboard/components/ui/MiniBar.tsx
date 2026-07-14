export function MiniBar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color = value >= max * 0.8 ? "bg-success" : value >= max * 0.5 ? "bg-warning" : "bg-error";

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-text-secondary truncate">{label}</span>
        <span className="text-xs font-semibold text-text-primary tabular-nums shrink-0">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
