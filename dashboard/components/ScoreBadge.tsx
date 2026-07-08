import { Badge } from "@/components/ui/Badge";

export function ScoreBadge({ score, tamanho = "sm" }: { score: number; tamanho?: "sm" | "lg" }) {
  const variant = score >= 1.6 ? "success" : score >= 1.0 ? "warning" : "error";

  return (
    <Badge variant={variant} size={tamanho}>
      {score.toFixed(1)}
    </Badge>
  );
}
