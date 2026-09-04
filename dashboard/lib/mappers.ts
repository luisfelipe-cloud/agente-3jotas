// Converte linhas cruas do Supabase (snake_case, nulls onde não há análise
// ainda) para os tipos que os componentes do dashboard já esperam.

import { CRITERIOS, type AnaliseDoDia, type AnaliseStatus, type ApresentacaoResumo, type CampanhaReativacaoLead, type CorretorRanking, type CriterioKey, type CriterioResultado, type ConversaAnalisada, type EtapaPlaybook, type ParametroCriterio, type PlaybookScript } from "./types";

interface CorretorRankingRow {
  corretor_id: string;
  nome_crm: string;
  ativo: boolean;
  total_conversas: number;
  conversas_com_nota: number;
  fluxo: number | null;
  fluidez: number | null;
  cta: number | null;
  clareza: number | null;
  playbook: number | null;
}

export function mapCorretorRanking(row: CorretorRankingRow): CorretorRanking {
  const porCriterio: [CriterioKey, number | null][] = [
    ["fluxo", row.fluxo],
    ["fluidez", row.fluidez],
    ["cta", row.cta],
    ["clareza", row.clareza],
    ["playbook", row.playbook],
  ];

  const mediaPorCriterio = Object.fromEntries(porCriterio.map(([c, v]) => [c, v ?? 0])) as Record<CriterioKey, number>;
  const valoresComDado = porCriterio.map(([, v]) => v).filter((v): v is number => v !== null);
  const mediaGeral = valoresComDado.length ? valoresComDado.reduce((a, b) => a + b, 0) / valoresComDado.length : 0;

  return {
    corretor: { id: row.corretor_id, nome_crm: row.nome_crm, ativo: row.ativo },
    totalConversas: row.total_conversas,
    conversasComNota: row.conversas_com_nota,
    mediaGeral,
    mediaPorCriterio,
  };
}

interface ConversaRow {
  id: string;
  iniciada_em: string;
  etapa_playbook: EtapaPlaybook | null;
  leadNome: string | null;
  leadTelefone: string | null;
  totalMensagens: number;
  mensagensDoLead: number;
  substituida_por_id: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- linha crua do Supabase, colunas dinâmicas por critério
function criteriosDaLinha(analise: Record<string, any> | undefined): Record<CriterioKey, CriterioResultado> {
  return Object.fromEntries(
    CRITERIOS.map((c) => [
      c,
      {
        score: analise?.[`${c}_score`] ?? 0,
        evidencia: analise?.[`${c}_evidencia`] ?? "",
        justificativa: analise?.[`${c}_justificativa`] ?? "",
      } satisfies CriterioResultado,
    ]),
  ) as Record<CriterioKey, CriterioResultado>;
}

function mediaCriterios(linhas: { [key: string]: unknown }[]): Record<CriterioKey, CriterioResultado> {
  return Object.fromEntries(
    CRITERIOS.map((c) => {
      const scores = linhas.map((l) => l[`${c}_score`]).filter((v): v is number => typeof v === "number");
      const media = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return [c, { score: media, evidencia: "", justificativa: "" } satisfies CriterioResultado];
    }),
  ) as Record<CriterioKey, CriterioResultado>;
}

// `analises` recebe uma linha por (conversa_id, dia) — uma conversa pode ter
// várias linhas de análise, uma por dia de atividade. `analises` aqui é a
// lista completa de linhas dessa conversa (sem filtro de período).
// `dataInicioISO`/`dataFimISO` (formato YYYY-MM-DD, inclusive nos dois
// extremos) recortam quais linhas contam pros campos escalares de
// ConversaAnalisada — sem isso, o card mostraria sempre a linha mais
// recente do HISTÓRICO INTEIRO da conversa, mesmo filtrando um dia em que
// ela já tinha nota (ex: conversa com nota concluída em 03/09 e uma
// interação nova ainda pendente em 04/09 — filtrar só 03/09 deve mostrar a
// nota de 03/09, não "pendente" da linha de 04/09 fora do filtro).
//
// Dentro do período: se houver pelo menos 1 linha 'concluida', o card
// agrega (status 'concluida', score = média dos dias concluídos do
// período) — evidência/justificativa ficam vazias nesse caso (texto não dá
// pra tirar média; olhar dia a dia é o que o expansor `historicoAnalises`
// é pra isso). Sem nenhuma linha 'concluida' no período, usa a linha mais
// recente do período (pendente/falhou/etc). Sem nenhuma linha no período,
// cai em 'nao_elegivel' (não há nada a mostrar pra esse recorte).
//
// `historicoAnalises` continua com TODAS as linhas da conversa (sem
// recorte de período) — é o detalhe completo por dia, não afetado pelo filtro.
export function mapConversaAnalisada(
  conversa: ConversaRow,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- linhas cruas do Supabase, colunas dinâmicas por critério
  analises: Record<string, any>[],
  periodo?: { dataInicioISO: string; dataFimISO: string },
): ConversaAnalisada {
  const ordenadas = [...analises].sort((a, b) => (a.dia < b.dia ? 1 : a.dia > b.dia ? -1 : 0));

  const historicoAnalises: AnaliseDoDia[] = ordenadas.map((a) => ({
    dia: a.dia,
    analisadoEm: a.analisado_em ?? null,
    status: (a.status as AnaliseStatus) ?? "nao_elegivel",
    criterios: criteriosDaLinha(a),
    justificativaGeral: a.justificativa_geral ?? "",
    revisado: a.revisado ?? false,
    resumoRevisao: a.resumo_revisao ?? null,
  }));

  const doPeriodo = periodo
    ? ordenadas.filter((a) => a.dia >= periodo.dataInicioISO && a.dia <= periodo.dataFimISO)
    : ordenadas;

  const concluidasDoPeriodo = doPeriodo.filter((a) => a.status === "concluida");

  let base: {
    analisadoEm: string | null;
    status: AnaliseStatus;
    criterios: Record<CriterioKey, CriterioResultado>;
    justificativaGeral: string;
    revisado: boolean;
    resumoRevisao: string | null;
  };

  if (concluidasDoPeriodo.length > 1) {
    // Múltiplos dias concluídos no período — agrega (ver comentário acima).
    const maisRecenteConcluida = concluidasDoPeriodo[0];
    base = {
      analisadoEm: maisRecenteConcluida.analisado_em ?? null,
      status: "concluida",
      criterios: mediaCriterios(concluidasDoPeriodo),
      justificativaGeral: "",
      revisado: concluidasDoPeriodo.every((a) => a.revisado),
      resumoRevisao: null,
    };
  } else if (concluidasDoPeriodo.length === 1) {
    // Só 1 dia concluído no período, mas pode haver outras linhas não
    // concluídas mais recentes no mesmo período (ex: 03/09 já com nota +
    // 04/09 ainda pendente, filtrando 03/09–04/09) — prioriza mostrar a nota
    // já existente em vez de esconder atrás de "pendente".
    const linha = concluidasDoPeriodo[0];
    base = {
      analisadoEm: linha.analisado_em ?? null,
      status: "concluida",
      criterios: criteriosDaLinha(linha),
      justificativaGeral: linha.justificativa_geral ?? "",
      revisado: linha.revisado ?? false,
      resumoRevisao: linha.resumo_revisao ?? null,
    };
  } else {
    const linha = doPeriodo[0];
    base = {
      analisadoEm: linha?.analisado_em ?? null,
      status: (linha?.status as AnaliseStatus) ?? "nao_elegivel",
      criterios: criteriosDaLinha(linha),
      justificativaGeral: linha?.justificativa_geral ?? "",
      revisado: linha?.revisado ?? false,
      resumoRevisao: linha?.resumo_revisao ?? null,
    };
  }

  return {
    conversaId: conversa.id,
    leadNome: conversa.leadNome ?? `Lead ${conversa.id.slice(0, 8)}`,
    leadTelefone: conversa.leadTelefone,
    iniciadaEm: conversa.iniciada_em,
    etapaPlaybook: conversa.etapa_playbook,
    totalMensagens: conversa.totalMensagens,
    mensagensDoLead: conversa.mensagensDoLead,
    substituidaPorId: conversa.substituida_por_id,
    historicoAnalises,
    ...base,
  };
}

interface ParametroCriterioRow {
  criterio: CriterioKey;
  nota_maxima: number;
  peso_percentual: number;
  descricao: string;
  ativo: boolean;
}

export function mapParametroCriterio(row: ParametroCriterioRow): ParametroCriterio {
  return {
    criterio: row.criterio,
    notaMaxima: row.nota_maxima,
    pesoPercentual: row.peso_percentual,
    descricao: row.descricao,
    ativo: row.ativo,
  };
}

interface PlaybookRow {
  id: string;
  etapa: EtapaPlaybook;
  conteudo: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export function mapPlaybookScript(row: PlaybookRow): PlaybookScript {
  return {
    id: row.id,
    etapa: row.etapa,
    conteudo: row.conteudo,
    ativo: row.ativo,
    criadoEm: row.created_at,
    atualizadoEm: row.updated_at,
  };
}

interface ApresentacaoRow {
  id: string;
  titulo: string;
  data_inicio: string;
  data_fim: string;
  criado_em: string;
}

export function mapApresentacaoResumo(row: ApresentacaoRow): ApresentacaoResumo {
  return {
    id: row.id,
    titulo: row.titulo,
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    criadoEm: row.criado_em,
  };
}

interface CampanhaReativacaoLeadRow {
  id: string;
  nome: string | null;
  telefone: string;
  status_importado: string | null;
  etapa_funil_importado: string | null;
  atendeu_11h: boolean;
  atendeu_16h: boolean;
  atendeu_18h: boolean;
  atendeu: boolean | null;
  deseja_continuar: boolean | null;
}

export function mapCampanhaReativacaoLead(row: CampanhaReativacaoLeadRow): CampanhaReativacaoLead {
  return {
    id: row.id,
    nome: row.nome,
    telefone: row.telefone,
    statusImportado: row.status_importado,
    etapaFunilImportado: row.etapa_funil_importado,
    atendeu11h: row.atendeu_11h,
    atendeu16h: row.atendeu_16h,
    atendeu18h: row.atendeu_18h,
    atendeu: row.atendeu,
    desejaContinuar: row.deseja_continuar,
  };
}
