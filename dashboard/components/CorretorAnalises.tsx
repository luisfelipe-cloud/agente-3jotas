"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CRITERIOS, CRITERIO_LABEL, ETAPA_LABEL, type ApresentacaoResumo, type ConversaAnalisada, type CriterioKey } from "@/lib/types";
import { mapApresentacaoResumo } from "@/lib/mappers";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MiniBar } from "@/components/ui/MiniBar";
import { ChatModal } from "@/components/ChatModal";
import { IconButton } from "@/components/ui/IconButton";
import { KebabMenu } from "@/components/ui/KebabMenu";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Toast, type ToastMensagem } from "@/components/ui/Toast";
import { IconPresentation } from "@/components/ui/icons";

function scoreColor(score: number) {
  return score >= 8 ? "bg-success" : score >= 5 ? "bg-warning" : "bg-error";
}

function motivoNaoAnalisada(c: ConversaAnalisada): string {
  return c.totalMensagens === 0 ? "Ainda sem mensagem do corretor." : "Aguardando processamento.";
}

interface InsightCorretor {
  texto: string;
  baseado_em_conversas: number;
  gerado_em: string;
}

export function CorretorAnalises({
  conversas,
  insight,
  corretorId,
  corretorNome,
  periodo,
  apresentacoesIniciais,
  filtro,
}: {
  conversas: ConversaAnalisada[];
  insight: InsightCorretor | null;
  corretorId: string;
  corretorNome: string;
  periodo: { inicio: string; fim: string };
  apresentacoesIniciais: ApresentacaoResumo[];
  filtro?: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Link "abrir conversa" da apresentação em HTML (lib/presentation.ts) usa
  // ?conversa={id} — abre direto o chat daquela conversa ao chegar aqui.
  const conversaParaAbrir = searchParams.get("conversa");
  const [secao, setSecao] = useState<"conversas" | "apresentacoes">("conversas");
  const [filtroConversas, setFiltroConversas] = useState<"analisadas" | "nao_analisadas">("analisadas");
  const [apresentacoes, setApresentacoes] = useState(apresentacoesIniciais);
  const [gerando, setGerando] = useState(false);
  const [excluindo, setExcluindo] = useState<ApresentacaoResumo | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [toast, setToast] = useState<ToastMensagem | null>(null);

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

  async function gerarApresentacao() {
    setGerando(true);
    try {
      const resp = await fetch("/api/apresentacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          corretorId,
          corretorNome,
          dataInicio: periodo.inicio,
          dataFim: periodo.fim,
          mediasPorCriterio,
          insight: insight?.texto ?? null,
          conversas: concluidas.map((c) => ({
            conversaId: c.conversaId,
            leadNome: c.leadNome,
            leadTelefone: c.leadTelefone,
            iniciadaEm: c.iniciadaEm,
            criterios: Object.fromEntries(
              CRITERIOS.map((k) => [k, { score: c.criterios[k].score, evidencia: c.criterios[k].evidencia, justificativa: c.criterios[k].justificativa }]),
            ),
          })),
        }),
      }).then((r) => r.json());

      if (resp.ok === false) throw new Error(resp.erro ?? "Falha ao gerar apresentação");

      setApresentacoes((prev) => [mapApresentacaoResumo(resp.apresentacao), ...prev]);
      setSecao("apresentacoes");
      setToast({ tipo: "ok", texto: "Apresentação gerada com sucesso." });
      router.refresh();
    } catch (err) {
      setToast({ tipo: "erro", texto: err instanceof Error ? err.message : "Falha ao gerar apresentação" });
    } finally {
      setGerando(false);
    }
  }

  async function confirmarExclusaoApresentacao() {
    if (!excluindo) return;
    setConfirmandoExclusao(true);
    try {
      const resp = await fetch(`/api/apresentacoes/${excluindo.id}`, { method: "DELETE" }).then((r) => r.json());
      if (resp.ok === false) throw new Error(resp.erro ?? "Falha ao excluir apresentação");

      setApresentacoes((prev) => prev.filter((a) => a.id !== excluindo.id));
      setExcluindo(null);
      setToast({ tipo: "ok", texto: "Apresentação excluída." });
      router.refresh();
    } catch (err) {
      setToast({ tipo: "erro", texto: err instanceof Error ? err.message : "Falha ao excluir apresentação" });
    } finally {
      setConfirmandoExclusao(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {filtro}
        <div className="flex items-center gap-2">
          <IconButton label="Gerar apresentação" onClick={gerarApresentacao} disabled={gerando} className="h-7 w-7">
            <IconPresentation className={`h-3.5 w-3.5 ${gerando ? "animate-pulse" : ""}`} />
          </IconButton>
          <div className="inline-flex rounded-full bg-gray-50 p-1">
            <button
              onClick={() => setSecao("conversas")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                secao === "conversas" ? "bg-navy-600 text-white shadow-sm" : "text-text-secondary hover:text-navy-600"
              }`}
            >
              Conversas
            </button>
            <button
              onClick={() => setSecao("apresentacoes")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                secao === "apresentacoes" ? "bg-navy-600 text-white shadow-sm" : "text-text-secondary hover:text-navy-600"
              }`}
            >
              Apresentações ({apresentacoes.length})
            </button>
          </div>
        </div>
      </div>

      {secao === "conversas" && (
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-navy-900">Conversas</h2>
              <div className="inline-flex rounded-full bg-gray-50 p-1">
                <button
                  onClick={() => setFiltroConversas("analisadas")}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    filtroConversas === "analisadas" ? "bg-navy-600 text-white shadow-sm" : "text-text-secondary hover:text-navy-600"
                  }`}
                >
                  Analisadas ({conversasAnalisadas.length})
                </button>
                <button
                  onClick={() => setFiltroConversas("nao_analisadas")}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    filtroConversas === "nao_analisadas" ? "bg-navy-600 text-white shadow-sm" : "text-text-secondary hover:text-navy-600"
                  }`}
                >
                  Não analisadas ({conversasNaoAnalisadas.length})
                </button>
              </div>
            </div>

            {filtroConversas === "analisadas" ? (
              <>
                {conversasAnalisadas.length === 0 && <p className="text-sm text-text-secondary">Nenhuma conversa neste período.</p>}
                {conversasAnalisadas.map((conversa) => (
                  <ConversaCard
                    key={conversa.conversaId}
                    conversa={conversa}
                    corretorNome={corretorNome}
                    abrirAutomaticamente={conversa.conversaId === conversaParaAbrir}
                  />
                ))}
              </>
            ) : (
              <>
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
                          <p className="font-semibold text-text-primary truncate">
                            {conversa.leadNome}
                            {conversa.leadTelefone && (
                              <span className="font-normal text-text-secondary"> · {conversa.leadTelefone}</span>
                            )}
                          </p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {new Date(conversa.iniciadaEm).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <Badge variant="neutral">{motivoNaoAnalisada(conversa)}</Badge>
                      </div>
                    </Card>
                  ))
                )}
              </>
            )}
          </div>
        </>
      )}

      {secao === "apresentacoes" && (
        <div className="space-y-3">
          <p className="text-xs text-text-secondary">
            Gerada a partir do período selecionado no filtro De/Até acima. Clique no ícone de apresentação pra criar uma nova.
          </p>
          {apresentacoes.length === 0 ? (
            <p className="text-sm text-text-secondary">Nenhuma apresentação gerada ainda.</p>
          ) : (
            apresentacoes.map((ap) => (
              <Card key={ap.id} variant="elevated" className="flex items-center justify-between gap-4 !rounded-md">
                <div className="min-w-0">
                  <p className="font-semibold text-text-primary truncate">{ap.titulo}</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Gerada em {new Date(ap.criadoEm).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <a
                    href={`/api/apresentacoes/${ap.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-navy-600 hover:underline"
                  >
                    Abrir →
                  </a>
                  <KebabMenu items={[{ label: "Excluir", onClick: () => setExcluindo(ap), tone: "danger" }]} />
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {excluindo && (
        <ConfirmModal
          titulo="Excluir apresentação"
          mensagem={`Excluir a apresentação "${excluindo.titulo}"? Essa ação não pode ser desfeita.`}
          confirmando={confirmandoExclusao}
          onConfirmar={confirmarExclusaoApresentacao}
          onCancelar={() => setExcluindo(null)}
        />
      )}

      {toast && <Toast mensagem={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

const STATUS_LABEL: Record<ConversaAnalisada["status"], string> = {
  pendente: "Pendente",
  processando: "Processando",
  falhou: "Falha na análise",
  concluida: "Concluída",
  nao_elegivel: "Não elegível",
  consolidada: "Consolidada em outra conversa",
};

function ConversaCard({
  conversa,
  corretorNome,
  abrirAutomaticamente,
}: {
  conversa: ConversaAnalisada;
  corretorNome: string;
  abrirAutomaticamente?: boolean;
}) {
  const [aberto, setAberto] = useState(!!abrirAutomaticamente);
  const [chatAberto, setChatAberto] = useState(!!abrirAutomaticamente);

  // Link "abrir conversa" (da apresentação em HTML) navega com ?conversa={id}
  // — como o componente já existe montado com esse id na primeira renderização
  // (não é uma troca de rota client-side depois), o useState acima já cobre a
  // maioria dos casos, mas o efeito garante mesmo se abrirAutomaticamente
  // chegar depois (ex: searchParams resolvendo async).
  useEffect(() => {
    if (abrirAutomaticamente) {
      setAberto(true);
      setChatAberto(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirAutomaticamente]);
  const analisada = conversa.status === "concluida";
  const criteriosComProblema = analisada ? CRITERIOS.filter((c) => conversa.criterios[c].score < 7.5) : [];

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
          <p className="font-semibold text-text-primary truncate">
            {conversa.leadNome}
            {conversa.leadTelefone && <span className="font-normal text-text-secondary"> · {conversa.leadTelefone}</span>}
          </p>
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
                : conversa.status === "consolidada"
                  ? "O Clint reabriu essa conversa com o lead em um chat novo — o contexto dela foi incluído na análise da conversa mais recente desse mesmo lead com esse corretor."
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
