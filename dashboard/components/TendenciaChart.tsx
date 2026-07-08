"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { DashboardOverview } from "@/lib/types";

export function TendenciaChart({ dados }: { dados: DashboardOverview["tendenciaDiaria"] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={dados} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="data" tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }} axisLine={false} tickLine={false} width={32} />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 2]}
          tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Line yAxisId="left" type="monotone" dataKey="interacoes" name="Interações" stroke="var(--color-navy-600)" strokeWidth={2} dot={false} />
        <Line yAxisId="right" type="monotone" dataKey="mediaScore" name="Média" stroke="var(--color-coral-600)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
