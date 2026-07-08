"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EtapaPlaybook, PlaybookScript } from "@/lib/types";
import { ETAPA_LABEL, ETAPAS_PLAYBOOK, versaoDoPlaybook } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { Modal } from "@/components/ui/Modal";
import { Toast, type ToastMensagem } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { IconPlus, IconClose, IconCheck, IconTrash } from "@/components/ui/icons";

export function PlaybooksForm({ playbooksIniciais }: { playbooksIniciais: PlaybookScript[] }) {
  const router = useRouter();
  const [playbooks, setPlaybooks] = useState(playbooksIniciais);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<PlaybookScript | null>(null);
  const [toast, setToast] = useState<ToastMensagem | null>(null);

  async function criarPlaybook(dados: { etapa: EtapaPlaybook; conteudo: string; ativo: boolean }) {
    const resp = await fetch("/api/playbooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    }).then((r) => r.json());

    if (resp.ok === false) throw new Error(resp.erro ?? "Falha ao criar script");

    const novo: PlaybookScript = {
      id: resp.playbook.id,
      etapa: resp.playbook.etapa,
      conteudo: resp.playbook.conteudo,
      ativo: resp.playbook.ativo,
      criadoEm: resp.playbook.created_at,
      atualizadoEm: resp.playbook.updated_at,
    };

    setPlaybooks((prev) => [...prev, novo]);
    setCriando(false);
    setToast({ tipo: "ok", texto: "Script criado com sucesso." });
    router.refresh();
  }

  async function salvarPlaybook(pb: PlaybookScript) {
    const resp = await fetch(`/api/playbooks/${pb.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ etapa: pb.etapa, conteudo: pb.conteudo, ativo: pb.ativo }),
    }).then((r) => r.json());

    if (resp.ok === false) throw new Error(resp.erro ?? "Falha ao salvar script");

    setPlaybooks((prev) => {
      // Ativar este desativa os demais da mesma etapa localmente — espelha o
      // índice único do banco (1 ativo por etapa).
      const atualizados = prev.map((p) => (p.id === pb.id ? pb : p.etapa === pb.etapa && pb.ativo ? { ...p, ativo: false } : p));
      return atualizados;
    });
    setEditando(null);
    setToast({ tipo: "ok", texto: "Script salvo com sucesso." });
    router.refresh();
  }

  async function excluirPlaybook(id: string) {
    const resp = await fetch(`/api/playbooks/${id}`, { method: "DELETE" }).then((r) => r.json());
    if (resp.ok === false) throw new Error(resp.erro ?? "Falha ao excluir script");

    setPlaybooks((prev) => prev.filter((p) => p.id !== id));
    setEditando(null);
    setToast({ tipo: "ok", texto: "Script excluído." });
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-navy-900">Scripts do playbook</p>
        <IconButton label="Novo script" onClick={() => setCriando(true)}>
          <IconPlus />
        </IconButton>
      </div>

      <div className="space-y-6">
        {ETAPAS_PLAYBOOK.map((etapa) => {
          const daEtapa = playbooks
            .filter((p) => p.etapa === etapa)
            .sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime());

          if (daEtapa.length === 0) return null;

          return (
            <div key={etapa} className="space-y-2">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">{ETAPA_LABEL[etapa]}</p>
              <Card className="!p-0 divide-y divide-border overflow-hidden">
                {daEtapa.map((pb) => {
                  const versao = versaoDoPlaybook(playbooks, pb.id);
                  return (
                    <button
                      key={pb.id}
                      onClick={() => setEditando(pb)}
                      className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-navy-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${pb.ativo ? "bg-success" : "bg-gray-300"}`} />
                        <Badge variant="progress">{versao}</Badge>
                        <p className="text-xs text-text-secondary truncate">
                          {pb.conteudo.trim() || "Sem conteúdo ainda"}
                        </p>
                      </div>
                      {pb.ativo && <Badge variant="success">Em uso</Badge>}
                    </button>
                  );
                })}
              </Card>
            </div>
          );
        })}
      </div>

      {criando && <NovoPlaybookModal onClose={() => setCriando(false)} onCriar={criarPlaybook} onErro={(texto) => setToast({ tipo: "erro", texto })} />}

      {editando && (
        <EditarPlaybookModal
          playbook={editando}
          onClose={() => setEditando(null)}
          onSalvar={salvarPlaybook}
          onExcluir={excluirPlaybook}
          onErro={(texto) => setToast({ tipo: "erro", texto })}
        />
      )}

      {toast && <Toast mensagem={toast} onDone={() => setToast(null)} />}
    </section>
  );
}

function EtapaSelect({ value, onChange }: { value: EtapaPlaybook; onChange: (v: EtapaPlaybook) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-text-primary">Etapa</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as EtapaPlaybook)}
        className="h-10 rounded-sm border border-border px-3 text-sm text-text-primary bg-white focus:outline-none focus:shadow-focus focus:border-navy-600"
      >
        {ETAPAS_PLAYBOOK.map((etapaOpcao) => (
          <option key={etapaOpcao} value={etapaOpcao}>
            {ETAPA_LABEL[etapaOpcao]}
          </option>
        ))}
      </select>
      <p className="text-xs text-text-secondary">Mudar a etapa recalcula a versão nas duas etapas envolvidas.</p>
    </div>
  );
}

function NovoPlaybookModal({
  onClose,
  onCriar,
  onErro,
}: {
  onClose: () => void;
  onCriar: (dados: { etapa: EtapaPlaybook; conteudo: string; ativo: boolean }) => Promise<void>;
  onErro: (texto: string) => void;
}) {
  const [etapa, setEtapa] = useState<EtapaPlaybook>("primeiro_contato");
  const [conteudo, setConteudo] = useState("");
  const [ativo, setAtivo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    setSalvando(true);
    setErro(null);
    try {
      await onCriar({ etapa, conteudo, ativo });
    } catch (err) {
      const texto = err instanceof Error ? err.message : "Falha ao criar script";
      setErro(texto);
      onErro(texto);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Novo script de playbook">
      <div className="space-y-4">
        <EtapaSelect value={etapa} onChange={setEtapa} />
        <Textarea label="Conteúdo" rows={7} value={conteudo} onChange={(e) => setConteudo(e.target.value)} className="text-xs leading-relaxed" />
        <Switch checked={ativo} onChange={setAtivo} label="Já deixar em uso pelo motor de análise" />

        {erro && <p className="text-sm text-error">{erro}</p>}

        <div className="flex items-center justify-end gap-3 pt-2">
          <IconButton label="Cancelar" onClick={onClose} disabled={salvando}>
            <IconClose />
          </IconButton>
          <IconButton label="Criar script" onClick={criar} disabled={salvando || !conteudo.trim()}>
            <IconCheck />
          </IconButton>
        </div>
      </div>
    </Modal>
  );
}

function EditarPlaybookModal({
  playbook,
  onClose,
  onSalvar,
  onExcluir,
  onErro,
}: {
  playbook: PlaybookScript;
  onClose: () => void;
  onSalvar: (pb: PlaybookScript) => Promise<void>;
  onExcluir: (id: string) => Promise<void>;
  onErro: (texto: string) => void;
}) {
  const [form, setForm] = useState(playbook);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar(form);
    } catch (err) {
      const texto = err instanceof Error ? err.message : "Falha ao salvar script";
      setErro(texto);
      onErro(texto);
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    setExcluindo(true);
    try {
      await onExcluir(playbook.id);
      setConfirmandoExclusao(false);
    } catch (err) {
      onErro(err instanceof Error ? err.message : "Falha ao excluir script");
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Editar script de playbook">
      <div className="space-y-4">
        <EtapaSelect value={form.etapa} onChange={(etapa) => setForm((f) => ({ ...f, etapa }))} />
        <Textarea
          label="Conteúdo"
          rows={7}
          value={form.conteudo}
          onChange={(e) => setForm((f) => ({ ...f, conteudo: e.target.value }))}
          className="text-xs leading-relaxed"
        />
        <Switch
          checked={form.ativo}
          onChange={(ativo) => setForm((f) => ({ ...f, ativo }))}
          label="Em uso pelo motor de análise"
        />

        {erro && <p className="text-sm text-error">{erro}</p>}

        <div className="flex items-center justify-between gap-3 pt-2">
          <IconButton label="Excluir script" onClick={() => setConfirmandoExclusao(true)} disabled={salvando}>
            <IconTrash />
          </IconButton>
          <div className="flex items-center gap-3">
            <IconButton label="Cancelar" onClick={onClose} disabled={salvando}>
              <IconClose />
            </IconButton>
            <IconButton label="Salvar" onClick={salvar} disabled={salvando}>
              <IconCheck />
            </IconButton>
          </div>
        </div>
      </div>

      {confirmandoExclusao && (
        <ConfirmModal
          titulo="Excluir script"
          mensagem="Excluir este script? A numeração de versão dos demais scripts da etapa será recalculada."
          confirmando={excluindo}
          onConfirmar={confirmarExclusao}
          onCancelar={() => setConfirmandoExclusao(false)}
        />
      )}
    </Modal>
  );
}
