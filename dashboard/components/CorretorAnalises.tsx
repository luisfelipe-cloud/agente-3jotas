"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CRITERIOS, CRITERIO_LABEL, ETAPA_LABEL, type ConversaAnalisada, type CriterioKey } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MiniBar } from "@/components/ui/MiniBar";
import { ChatModal } from "@/components/ChatModal";

function scoreColor(score: number) {
  return score >= 1.6 ? "bg-success" : score >= 1.0 ? "bg-warning" : "bg-error";
}

function motivoNaoAnalisada(c: ConversaAnalisada): string {
  const motivos: string[] = [];
  if (c.totalMensagens < 3) {
    motivos.push(`${c.totalMensagens} mensagem${c.totalMensagens === 1 ? "" : "s"} no total (mín. 3)`);
  }
  if (c.mensagensDoLead < 2) {
    motivos.push(`${c.mensagensDoLead} do lead (mín. 2)`);
  }
  return motivos.length ? motivos.join(" · ") : "Aguardando mais interação.";
}

interface InsightCorretor {
  texto: string;
  baseado_em_conversas: number;
  gerado_em: string;
}

export function CorretorAnalises({
  conversas,
  insight,
  corretorNome,
  filtro,
}: {
  conversas: ConversaAnalisada[];
  insight: InsightCorretor | null;
  corretorNome: string;
  filtro?: ReactNode;
}) {
  const [aba, setAba] = useState<"analisadas" | "nao_analisadas">("analisadas");

  const conversasAnalisadas = useMemo(() => conversas.filter((c) => c.status !== "nao_elegivel"), [conversas]);
  const conversasNaoAnalisadas = useMemo(() => conversas.filter((c) => c.status === "nao_elegivel"), [conversas]);

  const concluidas = useMemo(() => conversasAnalisadas.filter((c) => c.status === "concluida"), [conversasAnalisadas]);

  const mediasPorCriterio = useMemo(() => {
    return Object.fromEntries(
      CRITERIOS.map((c) => {
        const scores = concluidas.map((f) => f.criterios[c].score);
        const media = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        return [c, media];
      }),
    ) as Record<CriterioKey, number>;
  }, [concluidas]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {filtro}
        <div className="inline-flex rounded-full bg-gray-50 p-1">
          <button
            onClick={() => setAba("analisadas")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              aba === "analisadas" ? "bg-navy-600 text-white shadow-sm" : "text-text-secondary hover:text-navy-600"
            }`}
          >
            Analisadas ({conversasAnalisadas.length})
          </button>
          <button
            onClick={() => setAba("nao_analisadas")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              aba === "nao_analisadas" ? "bg-navy-600 text-white shadow-sm" : "text-text-secondary hover:text-navy-600"
            }`}
          >
            Não analisadas ({conversasNaoAnalisadas.length})
          </button>
        </div>
      </div>

      {aba === "analisadas" ? (
        <>
          <Card variant="elevated">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-4">
              Desempenho médio · {concluidas.length} conversa{concluidas.length === 1 ? "" : "s"} concluída
              {concluidas.length === 1 ? "" : "s"}
            </p>
            <div className="grid sm:grid-cols-2 gap-x-10 gap-y-5">
              {CRITERIOS.map((c) => (
                <MiniBar key={c} label={CRITERIO_LABEL[c]} value={mediasPorCriterio[c]} />
              ))}
            </div>
          </Card>

          <Card variant="elevated">
            <p className="text-sm font-semibold text-navy-900 mb-1">Como melhorar</p>
            {insight ? (
              <>
                <p className="text-sm text-text-primary leading-relaxed">{insight.texto}</p>
                <p className="text-xs text-text-secondary mt-3">
                  Gerado por IA a partir das {insight.baseado_em_conversas} análises mais recentes · atualizado em{" "}
                  {new Date(insight.gerado_em).toLocaleString("pt-BR")}
                </p>
              </>
            ) : (
              <p className="text-sm text-text-secondary">
                Ainda não há análises suficientes para gerar um insight sobre este corretor.
              </p>
            )}
          </Card>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-navy-900">Conversas</h2>
            {conversasAnalisadas.length === 0 && <p className="text-sm text-text-secondary">Nenhuma conversa neste período.</p>}
            {conversasAnalisadas.map((conversa) => (
              <ConversaCard key={conversa.conversaId} conversa={conversa} corretorNome={corretorNome} />
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-text-secondary">
            Conversas que ainda não atingiram o mínimo pra entrar na fila de análise (3 mensagens no total, sendo 2 do lead).
          </p>
          {conversasNaoAnalisadas.length === 0 ? (
            <p className="text-sm text-text-secondary">Nenhuma conversa não analisada neste período.</p>
          ) : (
            conversasNaoAnalisadas.map((conversa) => (
              <Card key={conversa.conversaId} variant="elevated" className="border-l-4 border-l-gray-300 !rounded-md">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary truncate">{conversa.leadNome}</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {new Date(conversa.iniciadaEm).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <Badge variant="neutral">{motivoNaoAnalisada(conversa)}</Badge>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<ConversaAnalisada["status"], string> = {
  pendente: "Pendente",
  processando: "Processando",
  falhou: "Falha na análise",
  concluida: "Concluída",
  nao_elegivel: "Não elegível",
};

function ConversaCard({ conversa, corretorNome }: { conversa: ConversaAnalisada; corretorNome: string }) {
  const [aberto, setAberto] = useState(false);
  const [chatAberto, setChatAberto] = useState(false);
  const analisada = conversa.status === "concluida";
  const criteriosComProblema = analisada ? CRITERIOS.filter((c) => conversa.criterios[c].score < 1.5) : [];

  const corBorda = !analisada
    ? "border-l-gray-300"
    : criteriosComProblema.length > 0
      ? "border-l-error"
      : "border-l-success";

  const mediaConversa = analisada
    ? CRITERIOS.reduce((soma, c) => soma + conversa.criterios[c].score, 0) / CRITERIOS.length
    : null;

  const analisadoEmDiaDiferente =
    analisada && conversa.analisadoEm && new Date(conversa.analisadoEm).toDateString() !== new Date(conversa.iniciadaEm).toDateString();

  return (
    <Card variant="elevated" className={`border-l-4 ${corBorda} !rounded-md`}>
      <button onClick={() => setAberto((v) => !v)} className="w-full flex items-center justify-between gap-4 text-left">
        <div className="min-w-0">
          <p className="font-semibold text-text-primary truncate">{conversa.leadNome}</p>
          <p className="text-xs text-text-secondary mt-0.5">
            {new Date(conversa.iniciadaEm).toLocaleString("pt-BR")}
            {conversa.etapaPlaybook && ` · ${ETAPA_LABEL[conversa.etapaPlaybook]}`}
            {analisadoEmDiaDiferente && ` · analisado em ${new Date(conversa.analisadoEm!).toLocaleDateString("pt-BR")}`}
            {analisada && conversa.revisado && " · revisado por IA"}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {analisada ? (
            <div className="hidden sm:flex items-center gap-2">
              <span className={`text-xs font-semibold ${scoreColor(mediaConversa!).replace("bg-", "text-")}`}>
                {mediaConversa!.toFixed(1)}
              </span>
              <div className="flex items-center gap-1">
                {CRITERIOS.map((c) => (
                  <span
                    key={c}
                    title={`${CRITERIO_LABEL[c]}: ${conversa.criterios[c].score.toFixed(1)}`}
                    className={`h-2.5 w-2.5 rounded-full ${scoreColor(conversa.criterios[c].score)}`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <Badge variant={conversa.status === "falhou" ? "error" : "neutral"}>
              {STATUS_LABEL[conversa.status]}
            </Badge>
          )}
          <span className={`text-text-secondary text-xs transition-transform ${aberto ? "rotate-180" : ""}`}>▾</span>
        </div>
      </button>

      {aberto && (
        <div className="mt-4 pt-4 border-t border-border space-y-3">
          <button
            onClick={() => setChatAberto(true)}
            className="text-sm font-medium text-navy-600 hover:underline"
          >
            Ver conversa completa →
          </button>
          {!analisada ? (
            <p className="text-sm text-text-secondary">
              {conversa.status === "falhou"
                ? "A análise dessa conversa falhou e será reprocessada."
                : "Essa conversa está na fila, aguardando ser analisada pelo motor de IA."}
            </p>
          ) : (
            <>
              <p className="text-sm text-text-primary">{conversa.justificativaGeral}</p>
              <div className="space-y-2.5">
                {CRITERIOS.map((c) => {
                  const r = conversa.criterios[c];
                  return (
                    <div key={c} className="flex gap-3 text-sm">
                      <div className="w-40 shrink-0 flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${scoreColor(r.score)}`} />
                        <span className="text-text-secondary">{CRITERIO_LABEL[c]}</span>
                      </div>
                      <div className="text-text-secondary">
                        <p className="italic">&ldquo;{r.evidencia}&rdquo;</p>
                        <p className="text-text-primary">{r.justificativa}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <ChatModal open={chatAberto} onClose={() => setChatAberto(false)} conversa={conversa} corretorNome={corretorNome} />
    </Card>
  );
}
