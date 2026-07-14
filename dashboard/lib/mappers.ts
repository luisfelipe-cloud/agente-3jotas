// Converte linhas cruas do Supabase (snake_case, nulls onde não há análise
// ainda) para os tipos que os componentes do dashboard já esperam.

import { CRITERIOS, type AnaliseStatus, type ApresentacaoResumo, type CorretorRanking, type CriterioKey, type CriterioResultado, type ConversaAnalisada, type EtapaPlaybook, type ParametroCriterio, type PlaybookScript } from "./types";

interface CorretorRankingRow {
  corretor_id: string;
  nome_crm: string;
  ativo: boolean;
  total_conversas: number;
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
}

export function mapConversaAnalisada(
  conversa: ConversaRow,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- linha crua do Supabase, colunas dinâmicas por critério
  analise: Record<string, any> | undefined,
): ConversaAnalisada {
  const criterios = Object.fromEntries(
    CRITERIOS.map((c) => [
      c,
      {
        score: analise?.[`${c}_score`] ?? 0,
        evidencia: analise?.[`${c}_evidencia`] ?? "",
        justificativa: analise?.[`${c}_justificativa`] ?? "",
      } satisfies CriterioResultado,
    ]),
  ) as Record<CriterioKey, CriterioResultado>;

  return {
    conversaId: conversa.id,
    leadNome: conversa.leadNome ?? `Lead ${conversa.id.slice(0, 8)}`,
    leadTelefone: conversa.leadTelefone,
    iniciadaEm: conversa.iniciada_em,
    analisadoEm: analise?.analisado_em ?? null,
    etapaPlaybook: conversa.etapa_playbook,
    status: (analise?.status as AnaliseStatus) ?? "nao_elegivel",
    criterios,
    justificativaGeral: analise?.justificativa_geral ?? "",
    totalMensagens: conversa.totalMensagens,
    mensagensDoLead: conversa.mensagensDoLead,
    revisado: analise?.revisado ?? false,
    resumoRevisao: analise?.resumo_revisao ?? null,
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
