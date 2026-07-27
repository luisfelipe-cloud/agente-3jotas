"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CampanhaReativacaoResumo } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Toast, type ToastMensagem } from "@/components/ui/Toast";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

interface ResultadoImportacao {
  campanhas: { corretorNome: string; totalLeads: number }[];
  naoEncontrados: { userName: string; nome: string | null }[];
  semTelefone: { nome: string | null }[];
}

export function ReativacaoBaseManager({ campanhasIniciais }: { campanhasIniciais: CampanhaReativacaoResumo[] }) {
  const router = useRouter();
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState(hojeISO());
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [toast, setToast] = useState<ToastMensagem | null>(null);

  async function importar() {
    const arquivo = inputArquivoRef.current?.files?.[0];
    if (!arquivo) {
      setToast({ tipo: "erro", texto: "Escolha um arquivo CSV primeiro." });
      return;
    }

    setEnviando(true);
    setResultado(null);
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      form.append("data", data);

      const resp = await fetch("/api/reativacao-base/importar", { method: "POST", body: form }).then((r) => r.json());
      if (resp.ok === false) throw new Error(resp.erro ?? "Falha ao importar CSV");

      setResultado(resp);
      setToast({ tipo: "ok", texto: `${resp.campanhas.length} campanha(s) criada(s)/atualizada(s).` });
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
        <p className="text-sm font-semibold text-navy-900">Importar CSV de leads perdidos</p>
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

        {resultado && (
          <div className="space-y-2 text-sm border-t border-border pt-4">
            {resultado.campanhas.map((c) => (
              <p key={c.corretorNome} className="text-text-primary">
                <span className="font-semibold">{c.corretorNome}</span>: {c.totalLeads} lead
                {c.totalLeads === 1 ? "" : "s"}
              </p>
            ))}
            {resultado.naoEncontrados.length > 0 && (
              <div className="text-warning">
                <p className="font-semibold">
                  {resultado.naoEncontrados.length} linha{resultado.naoEncontrados.length === 1 ? "" : "s"} sem corretor
                  correspondente:
                </p>
                <ul className="list-disc list-inside">
                  {resultado.naoEncontrados.slice(0, 10).map((n, i) => (
                    <li key={i}>
                      {n.nome ?? "(sem nome)"} — corretor no CSV: &ldquo;{n.userName}&rdquo;
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {resultado.semTelefone.length > 0 && (
              <p className="text-warning">
                {resultado.semTelefone.length} linha{resultado.semTelefone.length === 1 ? "" : "s"} sem telefone, ignorada
                {resultado.semTelefone.length === 1 ? "" : "s"}.
              </p>
            )}
          </div>
        )}
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-navy-900">Campanhas</h2>
        {campanhasIniciais.length === 0 ? (
          <p className="text-sm text-text-secondary">Nenhuma campanha importada ainda.</p>
        ) : (
          campanhasIniciais.map((c) => (
            <Card key={c.id} variant="elevated" className="flex items-center justify-between gap-4 !rounded-md">
              <div className="min-w-0">
                <Link href={`/reativacao-base/${c.corretorId}`} className="font-semibold text-text-primary truncate hover:underline block">
                  {c.corretorNome}
                </Link>
                <p className="text-xs text-text-secondary mt-0.5">
                  {new Date(`${c.data}T00:00:00`).toLocaleDateString("pt-BR")} · {c.totalRespondidos}/{c.totalLeads}{" "}
                  respondidos
                </p>
              </div>
              <button
                onClick={() => copiarLink(c.id)}
                className="text-sm font-medium text-navy-600 hover:underline shrink-0"
              >
                Copiar link
              </button>
            </Card>
          ))
        )}
      </div>

      {toast && <Toast mensagem={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
