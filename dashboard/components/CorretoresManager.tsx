"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CRITERIOS, type CorretorRanking } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { IconButton } from "@/components/ui/IconButton";
import { Switch } from "@/components/ui/Switch";
import { MiniBar } from "@/components/ui/MiniBar";
import { SincronizarButton } from "@/components/SincronizarButton";
import { Toast, type ToastMensagem } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { KebabMenu } from "@/components/ui/KebabMenu";
import { IconPlus, IconClose, IconCheck } from "@/components/ui/icons";

const CRITERIO_SIGLA: Record<(typeof CRITERIOS)[number], string> = {
  fluxo: "Fluxo",
  fluidez: "Fluidez",
  cta: "CTA",
  clareza: "Clareza",
  playbook: "Script",
};

function corDaMedia(score: number) {
  return score >= 8 ? "text-success" : score >= 5 ? "text-warning" : "text-error";
}

function iniciais(nome: string) {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
}

export function CorretoresManager({ ranking }: { ranking: CorretorRanking[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Preserva o período selecionado na lista ao entrar na página do corretor —
  // senão a tela de dentro sempre reseta pra "hoje", perdendo o filtro de
  // fora (ex: usuário escolheu 12 a 15, entra num corretor e via dados de
  // "hoje" em vez do período que ele tinha escolhido).
  const queryPeriodo = searchParams.toString();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [nomeForm, setNomeForm] = useState("");
  const [ativoForm, setAtivoForm] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMensagem | null>(null);
  const [excluindo, setExcluindo] = useState<CorretorRanking | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const ordenados = [...ranking].sort((a, b) => b.mediaGeral - a.mediaGeral);

  function iniciarEdicao(r: CorretorRanking) {
    setErro(null);
    setEditandoId(r.corretor.id);
    setCriando(false);
    setNomeForm(r.corretor.nome_crm);
    setAtivoForm(r.corretor.ativo);
  }

  function iniciarCriacao() {
    setErro(null);
    setCriando(true);
    setEditandoId(null);
    setNomeForm("");
    setAtivoForm(true);
  }

  function cancelar() {
    setCriando(false);
    setEditandoId(null);
    setErro(null);
  }

  async function salvarEdicao() {
    if (!nomeForm.trim() || !editandoId) return;
    setSalvando(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/corretores/${editandoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome_crm: nomeForm.trim(), ativo: ativoForm }),
      });
      const dados = await resp.json();
      if (!resp.ok || dados.ok === false) throw new Error(dados.erro ?? "Falha ao salvar");
      cancelar();
      setToast({ tipo: "ok", texto: "Corretor salvo com sucesso." });
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarCriacao() {
    if (!nomeForm.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      const resp = await fetch("/api/corretores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome_crm: nomeForm.trim(), ativo: ativoForm }),
      });
      const dados = await resp.json();
      if (!resp.ok || dados.ok === false) throw new Error(dados.erro ?? "Falha ao criar");
      cancelar();
      setToast({ tipo: "ok", texto: "Corretor criado com sucesso." });
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao criar");
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setConfirmando(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/corretores/${excluindo.corretor.id}`, { method: "DELETE" });
      const dados = await resp.json();
      if (!resp.ok || dados.ok === false) throw new Error(dados.erro ?? "Falha ao excluir");
      if (editandoId === excluindo.corretor.id) cancelar();
      setToast({ tipo: "ok", texto: "Corretor excluído." });
      setExcluindo(null);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao excluir");
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {ranking.length} corretor{ranking.length === 1 ? "" : "es"} cadastrado{ranking.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <SincronizarButton />
          <IconButton label="Novo corretor" onClick={iniciarCriacao}>
            <IconPlus />
          </IconButton>
        </div>
      </div>

      {erro && <p className="text-sm text-error">{erro}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {criando && (
          <Card variant="elevated" className="space-y-4 border-2 border-dashed !border-navy-400">
            <p className="text-sm font-semibold text-navy-900">Novo corretor</p>
            <Input label="Nome" value={nomeForm} onChange={(e) => setNomeForm(e.target.value)} placeholder="Nome como aparece no CRM" autoFocus />
            <Switch checked={ativoForm} onChange={setAtivoForm} label="Ativo" />
            <div className="flex items-center gap-2">
              <IconButton label="Salvar" onClick={salvarCriacao} disabled={!nomeForm.trim() || salvando}>
                <IconCheck />
              </IconButton>
              <IconButton label="Cancelar" onClick={cancelar} disabled={salvando}>
                <IconClose />
              </IconButton>
            </div>
          </Card>
        )}

        {ordenados.map((r, i) => {
          if (editandoId === r.corretor.id) {
            return (
              <Card key={r.corretor.id} variant="elevated" className="space-y-4">
                <p className="text-sm font-semibold text-navy-900">Editar corretor</p>
                <Input label="Nome" value={nomeForm} onChange={(e) => setNomeForm(e.target.value)} autoFocus />
                <Switch checked={ativoForm} onChange={setAtivoForm} label="Ativo" />
                <div className="flex items-center gap-2">
                  <IconButton label="Salvar" onClick={salvarEdicao} disabled={!nomeForm.trim() || salvando}>
                    <IconCheck />
                  </IconButton>
                  <IconButton label="Cancelar" onClick={cancelar} disabled={salvando}>
                    <IconClose />
                  </IconButton>
                </div>
              </Card>
            );
          }

          return (
            <Card key={r.corretor.id} variant="elevated" className="group relative h-full space-y-5 transition-all hover:shadow-lg">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative h-11 w-11 shrink-0 rounded-full bg-navy-600 text-white font-semibold flex items-center justify-center text-sm">
                    {iniciais(r.corretor.nome_crm)}
                    <span className="absolute -top-1.5 -left-1.5 h-5 w-5 rounded-full bg-white text-navy-600 text-[10px] font-bold flex items-center justify-center shadow-sm border border-border">
                      {i + 1}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary leading-tight">{r.corretor.nome_crm}</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {r.totalConversas} conversas {!r.corretor.ativo && "· inativo"}
                    </p>
                  </div>
                </div>
                <KebabMenu
                  items={[
                    { label: "Editar", onClick: () => iniciarEdicao(r) },
                    { label: "Excluir", onClick: () => setExcluindo(r), tone: "danger" },
                  ]}
                />
              </div>

              <div className="space-y-2.5">
                <div className="flex items-baseline justify-between gap-2 pb-0.5">
                  <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">Desempenho geral</p>
                  <span className={`text-sm font-bold tabular-nums shrink-0 ${corDaMedia(r.mediaGeral)}`}>
                    {r.mediaGeral.toFixed(1)}
                  </span>
                </div>
                {CRITERIOS.map((c) => (
                  <MiniBar key={c} label={CRITERIO_SIGLA[c]} value={r.mediaPorCriterio[c]} />
                ))}
              </div>

              <Link
                href={`/corretores/${r.corretor.id}${queryPeriodo ? `?${queryPeriodo}` : ""}`}
                className="block text-sm font-medium text-navy-600 hover:underline"
              >
                Ver análises →
              </Link>
            </Card>
          );
        })}
      </div>

      {excluindo && (
        <ConfirmModal
          titulo="Excluir corretor"
          mensagem={
            excluindo.totalConversas > 0
              ? `Excluir "${excluindo.corretor.nome_crm}"? Isso apaga também as ${excluindo.totalConversas} conversas dele no período — ação irreversível.`
              : `Excluir "${excluindo.corretor.nome_crm}"? Essa ação não pode ser desfeita.`
          }
          confirmando={confirmando}
          onConfirmar={confirmarExclusao}
          onCancelar={() => setExcluindo(null)}
        />
      )}

      {toast && <Toast mensagem={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
