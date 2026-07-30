"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CampanhaReativacaoResumo } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Toast, type ToastMensagem } from "@/components/ui/Toast";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export function ReativacaoCorretorPainel({
  corretorId,
  campanhasIniciais,
}: {
  corretorId: string;
  campanhasIniciais: CampanhaReativacaoResumo[];
}) {
  const router = useRouter();
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState(hojeISO());
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState<ToastMensagem | null>(null);

  async function importar() {
    const arquivo = inputArquivoRef.current?.files?.[0];
    if (!arquivo) {
      setToast({ tipo: "erro", texto: "Escolha um arquivo CSV primeiro." });
      return;
    }

    setEnviando(true);
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      form.append("data", data);

      const resp = await fetch(`/api/reativacao-base/${corretorId}/importar`, { method: "POST", body: form }).then((r) =>
        r.json(),
      );
      if (resp.ok === false) throw new Error(resp.erro ?? "Falha ao importar CSV");

      setToast({
        tipo: "ok",
        texto: `${resp.totalLeads} lead${resp.totalLeads === 1 ? "" : "s"} importado${resp.totalLeads === 1 ? "" : "s"}${resp.semTelefone ? ` (${resp.semTelefone} sem telefone, ignorado${resp.semTelefone === 1 ? "" : "s"})` : ""}.`,
      });
      if (inputArquivoRef.current) inputArquivoRef.current.value = "";
      router.refresh();
    } catch (err) {
      setToast({ tipo: "erro", texto: err instanceof Error ? err.message : "Falha ao importar CSV" });
    } finally {
      setEnviando(false);
    }
  }

  async function copiarLink(campanhaId: string) {
    const link = `${window.location.origin}/reativacao/${campanhaId}`;
    await navigator.clipboard.writeText(link);
    setToast({ tipo: "ok", texto: "Link copiado." });
  }

  return (
    <div className="space-y-6">
      <Card variant="elevated" className="space-y-4">
        <p className="text-sm font-semibold text-navy-900">Importar lista de leads perdidos</p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-secondary">Data da bateria de ligação</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="h-9 rounded-sm border border-border px-2 text-sm bg-white focus:outline-none focus:shadow-focus focus:border-navy-600"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-secondary">Arquivo CSV</label>
            <input
              ref={inputArquivoRef}
              type="file"
              accept=".csv,text/csv"
              className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-navy-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-navy-600 hover:file:bg-navy-100"
            />
          </div>
          <button
            onClick={importar}
            disabled={enviando}
            className="h-9 rounded-full px-5 text-sm font-medium bg-coral-600 text-white hover:bg-coral-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enviando ? "Importando…" : "Importar"}
          </button>
        </div>
      </Card>

      {campanhasIniciais.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-navy-900">Baterias importadas</h2>
          {campanhasIniciais.map((c) => (
            <Card key={c.id} variant="elevated" className="flex items-center justify-between gap-4 !rounded-md">
              <div className="min-w-0">
                <p className="font-semibold text-text-primary truncate">
                  {new Date(`${c.data}T00:00:00`).toLocaleDateString("pt-BR")}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  {c.totalRespondidos}/{c.totalLeads} respondidos
                </p>
              </div>
              <button
                onClick={() => copiarLink(c.id)}
                className="text-sm font-medium text-navy-600 hover:underline shrink-0"
              >
                Copiar link
              </button>
            </Card>
          ))}
        </div>
      )}

      {toast && <Toast mensagem={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
