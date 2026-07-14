"use client";

import { useEffect, useState } from "react";
import type { ConversaAnalisada, MensagemChat } from "@/lib/types";
import { anotarMensagens, type AnotacaoCriterio } from "@/lib/chat-annotations";
import { Modal } from "@/components/ui/Modal";

const TOM_CLASSES: Record<AnotacaoCriterio["tom"], string> = {
  positivo: "bg-success/10 text-success border-success/30",
  neutro: "bg-warning/10 text-warning border-warning/30",
  negativo: "bg-error/10 text-error border-error/30",
};

export function ChatModal({
  open,
  onClose,
  conversa,
  corretorNome,
}: {
  open: boolean;
  onClose: () => void;
  conversa: ConversaAnalisada;
  corretorNome: string;
}) {
  const [mensagens, setMensagens] = useState<MensagemChat[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMensagens(null);
    setErro(null);
    fetch(`/api/conversas/${conversa.conversaId}/mensagens`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok === false) throw new Error(data.erro ?? "Falha ao carregar mensagens");
        setMensagens(data.mensagens);
      })
      .catch((err) => setErro(err instanceof Error ? err.message : "Falha ao carregar mensagens"));
  }, [open, conversa.conversaId]);

  const analisada = conversa.status === "concluida";
  const anotacoesPorMensagem: Map<string, AnotacaoCriterio[]> =
    mensagens && analisada ? anotarMensagens(mensagens, conversa.criterios) : new Map();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Conversa com ${conversa.leadNome}${conversa.leadTelefone ? ` · ${conversa.leadTelefone}` : ""}`}
    >
      <div className="space-y-4">
        {analisada && conversa.justificativaGeral && (
          <p className="text-sm text-text-secondary bg-navy-50 rounded-md px-3 py-2">{conversa.justificativaGeral}</p>
        )}

        {analisada && conversa.revisado && (
          <div className="text-xs text-navy-600 bg-navy-50 rounded-md px-3 py-2 border border-navy-100">
            <span className="font-semibold">Revisado por IA com contexto completo da conversa.</span>
            {conversa.resumoRevisao && <span> {conversa.resumoRevisao}</span>}
          </div>
        )}

        {erro && <p className="text-sm text-error">{erro}</p>}

        {!mensagens && !erro && <p className="text-sm text-text-secondary">Carregando conversa...</p>}

        {mensagens && mensagens.length === 0 && (
          <p className="text-sm text-text-secondary">Nenhuma mensagem registrada nesta conversa.</p>
        )}

        {mensagens && mensagens.length > 0 && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {mensagens.map((m) => {
              const doCorretor = m.remetente === "corretor";
              const anotacoes = anotacoesPorMensagem.get(m.id) ?? [];
              return (
                <div key={m.id} className={`flex flex-col ${doCorretor ? "items-end" : "items-start"}`}>
                  <span className="text-[11px] text-text-secondary mb-0.5 px-1">
                    {doCorretor ? corretorNome : conversa.leadNome}
                  </span>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                      doCorretor ? "bg-navy-600 text-white rounded-tr-none" : "bg-gray-100 text-text-primary rounded-tl-none"
                    }`}
                  >
                    {m.texto}
                  </div>
                  <span className="text-[10px] text-text-secondary mt-0.5 px-1">
                    {new Date(m.enviadaEm).toLocaleString("pt-BR")}
                  </span>

                  {anotacoes.length > 0 && (
                    <div className={`flex flex-wrap gap-1.5 mt-1 max-w-[80%] ${doCorretor ? "justify-end" : "justify-start"}`}>
                      {anotacoes.map((a) => (
                        <div key={a.criterio} className="group relative">
                          <span
                            className={`text-[11px] font-medium border rounded-full px-2 py-0.5 cursor-help ${TOM_CLASSES[a.tom]}`}
                          >
                            {a.tom === "positivo" ? "✓" : a.tom === "negativo" ? "✕" : "•"} {a.label}
                          </span>
                          <div
                            className={`invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute z-10 top-full mt-2 w-56 rounded-md bg-navy-900 text-white text-xs p-2.5 shadow-lg ${
                              doCorretor ? "right-0" : "left-0"
                            }`}
                          >
                            <p className="font-semibold mb-1">
                              {a.label} · {a.tom === "positivo" ? "Ponto positivo" : a.tom === "negativo" ? "Ponto negativo" : "Neutro"}
                            </p>
                            <p className="text-white/85 leading-snug">{a.justificativa}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
