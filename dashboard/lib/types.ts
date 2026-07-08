export type EtapaPlaybook =
  | "primeiro_contato"
  | "envio_simulacao"
  | "resultado_analise";

export type AnaliseStatus = "pendente" | "processando" | "concluida" | "falhou" | "nao_elegivel";

export interface Corretor {
  id: string;
  nome_crm: string;
  ativo: boolean;
}

export interface CriterioResultado {
  score: number;
  evidencia: string;
  justificativa: string;
}

export const CRITERIOS = [
  "fluxo",
  "fluidez",
  "cta",
  "clareza",
  "playbook",
] as const;

export type CriterioKey = (typeof CRITERIOS)[number];

export const CRITERIO_LABEL: Record<CriterioKey, string> = {
  fluxo: "Fluxo Ligação/Mensagem",
  fluidez: "Fluidez",
  cta: "CTA",
  clareza: "Clareza da Informação",
  playbook: "Aderência ao Playbook",
};

export interface MensagemChat {
  id: string;
  remetente: "corretor" | "lead";
  texto: string;
  enviadaEm: string;
}

export interface ConversaAnalisada {
  conversaId: string;
  leadNome: string;
  iniciadaEm: string;
  analisadoEm: string | null;
  etapaPlaybook: EtapaPlaybook | null;
  status: AnaliseStatus;
  criterios: Record<CriterioKey, CriterioResultado>;
  justificativaGeral: string;
  totalMensagens: number;
  mensagensDoLead: number;
  revisado: boolean;
  resumoRevisao: string | null;
}

export interface CorretorRanking {
  corretor: Corretor;
  totalConversas: number;
  mediaGeral: number;
  mediaPorCriterio: Record<CriterioKey, number>;
}

// --- Configurações -------------------------------------------------------

export interface ParametroCriterio {
  criterio: CriterioKey;
  notaMaxima: number; // escala 0..N usada na avaliação (ex: 0-2)
  pesoPercentual: number; // peso desse critério na média geral, soma deve dar 100
  descricao: string; // instrução enviada ao LLM para avaliar esse critério
  ativo: boolean;
}

export interface PlaybookScript {
  id: string;
  etapa: EtapaPlaybook;
  conteudo: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export const ETAPAS_PLAYBOOK: EtapaPlaybook[] = [
  "primeiro_contato",
  "envio_simulacao",
  "resultado_analise",
];

// A versão de um script é sempre a posição dele entre os scripts da mesma etapa,
// ordenados por criação — 1º cadastrado na etapa é V1, o próximo é V2, e assim por diante.
export function versaoDoPlaybook(playbooks: PlaybookScript[], playbookId: string): string {
  const daMesmaEtapa = playbooks
    .filter((p) => p.etapa === playbooks.find((x) => x.id === playbookId)?.etapa)
    .sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime());
  const posicao = daMesmaEtapa.findIndex((p) => p.id === playbookId);
  return `V${posicao + 1}`;
}

export const ETAPA_LABEL: Record<EtapaPlaybook, string> = {
  primeiro_contato: "1º Contato",
  envio_simulacao: "Envio de Simulação",
  resultado_analise: "Resultado de Análise",
};

// --- Dashboard overview ----------------------------------------------------

export interface PontoAtencao {
  corretorId: string;
  corretorNome: string;
  criterio: CriterioKey;
  descricao: string;
  conversaId: string;
}

export interface CorretorComErros {
  corretorId: string;
  corretorNome: string;
  totalErros: number;
  criterioMaisFraco: CriterioKey;
}

export interface DashboardOverview {
  chatsAnalisadosHoje: number;
  variacaoChatsAnalisadosPercentual: number;
  conversasPendentesAnalise: number;
  mediaGeralQuinzena: number;
  tendenciaDiaria: { data: string; interacoes: number; mediaScore: number }[];
  pontosAtencao: PontoAtencao[];
  corretoresComMaisErros: CorretorComErros[];
  distribuicaoPorCriterio: Record<CriterioKey, number>;
}
