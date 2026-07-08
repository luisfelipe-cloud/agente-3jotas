"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ParametroCriterio } from "@/lib/types";
import { CRITERIO_LABEL } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { IconButton } from "@/components/ui/IconButton";
import { Switch } from "@/components/ui/Switch";
import { Modal } from "@/components/ui/Modal";
import { Toast, type ToastMensagem } from "@/components/ui/Toast";
import { IconClose, IconCheck } from "@/components/ui/icons";

const DESCRICAO_MAX_LENGTH = 5000;

export function ParametrosForm({ parametrosIniciais }: { parametrosIniciais: ParametroCriterio[] }) {
  const router = useRouter();
  const [parametros, setParametros] = useState(parametrosIniciais);
  const [editando, setEditando] = useState<ParametroCriterio | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMensagem | null>(null);

  const somaPesos = parametros.reduce((acc, p) => acc + (p.ativo ? p.pesoPercentual : 0), 0);

  async function salvarParametro(patch: ParametroCriterio) {
    setSalvando(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/parametros/${patch.criterio}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descricao: patch.descricao,
          notaMaxima: patch.notaMaxima,
          pesoPercentual: patch.pesoPercentual,
          ativo: patch.ativo,
        }),
      }).then((r) => r.json());

      if (resp.ok === false) throw new Error(resp.erro ?? "Falha ao salvar");

      setParametros((prev) => prev.map((p) => (p.criterio === patch.criterio ? patch : p)));
      setEditando(null);
      setToast({ tipo: "ok", texto: "Critério salvo com sucesso." });
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-navy-900">Critérios de avaliação</p>
          <p className="text-xs text-text-secondary mt-0.5">
            Clique em um critério para ajustar peso, escala e a instrução enviada ao motor de IA.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-xs font-medium ${somaPesos === 100 ? "text-success" : "text-warning"}`}>Peso total {somaPesos}%</p>
          <div className="w-32 h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1">
            <div
              className={`h-full rounded-full ${somaPesos === 100 ? "bg-success" : "bg-warning"}`}
              style={{ width: `${Math.min(100, somaPesos)}%` }}
            />
          </div>
        </div>
      </div>

      {erro && !editando && <p className="text-sm text-error">{erro}</p>}

      <Card className="!p-0 divide-y divide-border overflow-hidden">
        {parametros.map((p) => (
          <button
            key={p.criterio}
            onClick={() => setEditando(p)}
            className={`w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-navy-50 transition-colors ${!p.ativo ? "opacity-50" : ""}`}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">{CRITERIO_LABEL[p.criterio]}</p>
              <p className="text-xs text-text-secondary truncate max-w-md">{p.descricao}</p>
            </div>
            <div className="flex items-center gap-4 shrink-0 text-xs text-text-secondary">
              <span>Escala 0-{p.notaMaxima}</span>
              <span>Peso {p.pesoPercentual}%</span>
              {!p.ativo && <span className="text-warning font-medium">Inativo</span>}
            </div>
          </button>
        ))}
      </Card>

      {editando && (
        <ParametroModal
          parametro={editando}
          salvando={salvando}
          erro={erro}
          onClose={() => {
            setEditando(null);
            setErro(null);
          }}
          onSave={salvarParametro}
        />
      )}

      {toast && <Toast mensagem={toast} onDone={() => setToast(null)} />}
    </section>
  );
}

function ParametroModal({
  parametro,
  salvando,
  erro,
  onClose,
  onSave,
}: {
  parametro: ParametroCriterio;
  salvando: boolean;
  erro: string | null;
  onClose: () => void;
  onSave: (p: ParametroCriterio) => void;
}) {
  const [form, setForm] = useState(parametro);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [form.descricao]);

  return (
    <Modal open onClose={onClose} title={CRITERIO_LABEL[parametro.criterio]}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-primary">Critério ativo</span>
          <Switch checked={form.ativo} onChange={(v) => setForm((f) => ({ ...f, ativo: v }))} />
        </div>

        <Textarea
          ref={textareaRef}
          label="Instrução para a IA"
          value={form.descricao}
          onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value.slice(0, DESCRICAO_MAX_LENGTH) }))}
          maxLength={DESCRICAO_MAX_LENGTH}
          rows={7}
          className="text-xs leading-relaxed resize-none overflow-hidden"
        />
        <p className="text-xs text-text-secondary text-right -mt-2">
          {form.descricao.length}/{DESCRICAO_MAX_LENGTH}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            label="Nota máxima"
            min={1}
            max={10}
            value={form.notaMaxima}
            onChange={(e) => setForm((f) => ({ ...f, notaMaxima: Number(e.target.value) }))}
          />
          <Input
            type="number"
            label="Peso (%)"
            min={0}
            max={100}
            value={form.pesoPercentual}
            onChange={(e) => setForm((f) => ({ ...f, pesoPercentual: Number(e.target.value) }))}
          />
        </div>

        {erro && <p className="text-sm text-error">{erro}</p>}

        <div className="flex items-center justify-end gap-3 pt-2">
          <IconButton label="Cancelar" onClick={onClose} disabled={salvando}>
            <IconClose />
          </IconButton>
          <IconButton label="Salvar" onClick={() => onSave(form)} disabled={salvando}>
            <IconCheck />
          </IconButton>
        </div>
      </div>
    </Modal>
  );
}
