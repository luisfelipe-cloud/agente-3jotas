import { Badge } from "@/components/ui/Badge";

export function ScoreBadge({ score, tamanho = "sm" }: { score: number; tamanho?: "sm" | "lg" }) {
  const variant = score >= 8 ? "success" : score >= 5 ? "warning" : "error";

  return (
    <Badge variant={variant} size={tamanho}>
      {score.toFixed(1)}
    </Badge>
  );
}
