"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { IconPlay } from "@/components/ui/icons";

interface Resultado {
  ok: boolean;
  sync?: unknown;
  analise?: unknown;
  revisao?: unknown;
  erro?: string;
}

export function BuscarEAnalisarButton() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function rodar() {
    setCarregando(true);
    setResultado(null);
    try {
      const resp = await fetch("/api/buscar-e-analisar", { method: "POST" });
      const dados = await resp.json();
      setResultado(dados);
      router.refresh();
    } catch (err) {
      setResultado({ ok: false, erro: err instanceof Error ? err.message : "Falha ao rodar o fluxo" });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <IconButton
          label="Buscar e analisar conversas"
          onClick={rodar}
          disabled={carregando}
          className={carregando ? "animate-pulse" : ""}
        >
          <IconPlay />
        </IconButton>
        <span className="text-xs text-text-secondary">
          {carregando ? "Rodando..." : "Buscar e analisar conversas"} — fins de teste, roda sync-clint →
          analyze-conversation-sweep → analyze-conversation-review na hora, o mesmo caminho que os crons rodam
          sozinhos em produção.
        </span>
      </div>

      {resultado && (
        <Card variant="border" className="text-xs">
          <p className={`font-semibold mb-2 ${resultado.ok ? "text-success" : "text-error"}`}>
            {resultado.ok ? "Fluxo concluído" : resultado.erro ?? "Fluxo terminou com falhas"}
          </p>
          <pre className="whitespace-pre-wrap break-words text-text-secondary">
            {JSON.stringify({ sync: resultado.sync, analise: resultado.analise, revisao: resultado.revisao }, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}
