"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CampanhaReativacaoResumo } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { KebabMenu } from "@/components/ui/KebabMenu";
import { Toast, type ToastMensagem } from "@/components/ui/Toast";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export function ReativacaoCorretorPainel({
  corretorId,
  campanhasIniciais,
  filtro,
}: {
  corretorId: string;
  campanhasIniciais: CampanhaReativacaoResumo[];
  filtro?: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [data, setData] = useState(hojeISO());
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState<ToastMensagem | null>(null);
  const [excluindo, setExcluindo] = useState<CampanhaReativacaoResumo | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  // Mesmo período do filtro De/Até já visível na tela (PeriodoCorretoresFiltro)
  // — exportar traz exatamente os leads que aparecem na lista abaixo.
  const inicioExport = searchParams.get("inicio") ?? hojeISO();
  const fimExport = searchParams.get("fim") ?? hojeISO();
  const linkExportar = `/api/reativacao-base/${corretorId}/exportar?inicio=${inicioExport}&fim=${fimExport}`;

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
      setModalAberto(false);
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

  async function confirmarExclusao() {
    if (!excluindo) return;
    setConfirmandoExclusao(true);
    try {
      const resp = await fetch(`/api/reativacao-base/campanhas/${excluindo.id}`, { method: "DELETE" }).then((r) => r.json());
      if (resp.ok === false) throw new Error(resp.erro ?? "Falha ao excluir bateria");
      setExcluindo(null);
      setToast({ tipo: "ok", texto: "Bateria excluída." });
      router.refresh();
    } catch (err) {
      setToast({ tipo: "erro", texto: err instanceof Error ? err.message : "Falha ao excluir bateria" });
    } finally {
      setConfirmandoExclusao(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {filtro}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setModalAberto(true)}
            className="h-9 rounded-full px-5 text-sm font-medium bg-coral-600 text-white hover:bg-coral-700"
          >
            Importar leads
          </button>
          <a
            href={linkExportar}
            className="h-9 inline-flex items-center rounded-full px-5 text-sm font-medium bg-navy-600 text-white hover:bg-navy-700"
          >
            Exportar não atendidos
          </a>
        </div>
      </div>

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
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => copiarLink(c.id)} className="text-sm font-medium text-navy-600 hover:underline">
                  Copiar link
                </button>
                <KebabMenu items={[{ label: "Excluir", onClick: () => setExcluindo(c), tone: "danger" }]} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalAberto} onClose={() => setModalAberto(false)} title="Importar lista de leads perdidos">
        <div className="space-y-4">
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
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setModalAberto(false)}
              disabled={enviando}
              className="h-9 rounded-full px-4 text-sm font-medium text-text-secondary hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={importar}
              disabled={enviando}
              className="h-9 rounded-full px-5 text-sm font-medium bg-coral-600 text-white hover:bg-coral-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enviando ? "Importando…" : "Importar"}
            </button>
          </div>
        </div>
      </Modal>

      {excluindo && (
        <ConfirmModal
          titulo="Excluir bateria"
          mensagem={`Excluir a bateria de ${new Date(`${excluindo.data}T00:00:00`).toLocaleDateString("pt-BR")}? Isso apaga também os ${excluindo.totalLeads} leads dela — ação irreversível.`}
          confirmando={confirmandoExclusao}
          onConfirmar={confirmarExclusao}
          onCancelar={() => setExcluindo(null)}
        />
      )}

      {toast && <Toast mensagem={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
