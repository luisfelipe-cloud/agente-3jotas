"use client";

import { useState } from "react";
import type { CampanhaReativacaoLead } from "@/lib/types";
import { Card } from "@/components/ui/Card";

type StatusSalvamento = "idle" | "salvando" | "salvo" | "erro";

type CampoAtualizavel = Pick<
  CampanhaReativacaoLead,
  "atendeu11h" | "atendeu16h" | "atendeu18h" | "atendeu" | "desejaContinuar"
>;

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 min-w-[3.25rem] px-4 rounded-full text-sm font-semibold border transition-colors active:scale-95 ${
        ativo
          ? "bg-coral-600 border-coral-600 text-white"
          : "bg-white border-border text-text-secondary hover:border-coral-400"
      }`}
    >
      {children}
    </button>
  );
}

function SimNaoToggle({
  label,
  valor,
  onChange,
}: {
  label: string;
  valor: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <div className="flex gap-2">
        <Chip ativo={valor === true} onClick={() => onChange(true)}>
          Sim
        </Chip>
        <Chip ativo={valor === false} onClick={() => onChange(false)}>
          Não
        </Chip>
      </div>
    </div>
  );
}

function StatusIndicador({ status }: { status: StatusSalvamento }) {
  if (status === "salvando") return <span className="text-xs text-text-secondary">Salvando…</span>;
  if (status === "salvo") return <span className="text-xs text-success">Salvo ✓</span>;
  if (status === "erro") return <span className="text-xs text-error">Falha ao salvar</span>;
  return null;
}

export function ReativacaoForm({
  campanhaId,
  leadsIniciais,
}: {
  campanhaId: string;
  leadsIniciais: CampanhaReativacaoLead[];
}) {
  const [leads, setLeads] = useState(leadsIniciais);
  const [statusPorLead, setStatusPorLead] = useState<Record<string, StatusSalvamento>>({});

  async function salvarCampo(leadId: string, patch: Partial<CampoAtualizavel>) {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, ...patch } : l)));
    setStatusPorLead((s) => ({ ...s, [leadId]: "salvando" }));

    try {
      const resp = await fetch(`/api/reativacao/${campanhaId}/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then((r) => r.json());

      if (resp.ok === false) throw new Error(resp.erro ?? "Falha ao salvar");

      setStatusPorLead((s) => ({ ...s, [leadId]: "salvo" }));
      setTimeout(() => setStatusPorLead((s) => (s[leadId] === "salvo" ? { ...s, [leadId]: "idle" } : s)), 1500);
    } catch {
      setStatusPorLead((s) => ({ ...s, [leadId]: "erro" }));
    }
  }

  return (
    <div className="space-y-3">
      {leads.length === 0 && <p className="text-sm text-text-secondary">Nenhum lead nessa lista.</p>}

      {leads.map((lead) => (
        <Card key={lead.id} variant="elevated" className="!rounded-md space-y-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-text-primary truncate">
                {lead.nome ?? "Sem nome"} -{" "}
                <a href={`tel:${lead.telefone}`} className="font-normal text-navy-600 underline underline-offset-2">
                  {lead.telefone}
                </a>
              </p>
              {(lead.statusImportado || lead.etapaFunilImportado) && (
                <p className="text-xs text-text-secondary mt-0.5">
                  {[lead.statusImportado, lead.etapaFunilImportado].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <StatusIndicador status={statusPorLead[lead.id] ?? "idle"} />
          </div>

          <div className="flex flex-wrap items-start gap-5 border-t border-border pt-3.5">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">Ligou</span>
              <div className="flex gap-2">
                <Chip ativo={lead.atendeu11h} onClick={() => salvarCampo(lead.id, { atendeu11h: !lead.atendeu11h })}>
                  11h
                </Chip>
                <Chip ativo={lead.atendeu16h} onClick={() => salvarCampo(lead.id, { atendeu16h: !lead.atendeu16h })}>
                  16h
                </Chip>
                <Chip ativo={lead.atendeu18h} onClick={() => salvarCampo(lead.id, { atendeu18h: !lead.atendeu18h })}>
                  18h
                </Chip>
              </div>
            </div>
            <div className="w-px self-stretch bg-border" />
            <SimNaoToggle label="Atendeu?" valor={lead.atendeu} onChange={(v) => salvarCampo(lead.id, { atendeu: v })} />
            <div className="w-px self-stretch bg-border" />
            <SimNaoToggle
              label="Deseja continuar?"
              valor={lead.desejaContinuar}
              onChange={(v) => salvarCampo(lead.id, { desejaContinuar: v })}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}
