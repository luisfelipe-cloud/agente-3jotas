// 1º passe do pipeline de análise, em lote — processa todas as conversas
// pendentes de uma vez via Gemini Batch API (50% mais barato que a chamada
// síncrona; prazo de até 24h, mas normalmente bem mais rápido — um teste
// com 2 requests levou ~2min30s). Substitui o caminho antigo em tempo real
// (analyze-conversation-sweep, desligado — ver migration 0024): a ideia
// agora é rodar 1x de madrugada e ter o resumo do dia anterior pronto de
// manhã, não análise instantânea.
//
// Resultados não saem na hora daqui — ver analysis-batch-poll, que consulta
// o status do lote e, quando terminar, já encadeia a submissão do lote de
// revisão (2º passe) automaticamente, sem precisar de outro cron.
//
// Disparo sugerido: pg_cron 1x por noite/madrugada, mesmo CRON_SECRET dos
// demais crons.

import { createClient } from "jsr:@supabase/supabase-js@2";

// Arquivo único e autocontido (sem pasta _shared) para colar direto no editor
// do dashboard do Supabase.

type EtapaPlaybook = "primeiro_contato" | "envio_simulacao" | "resultado_analise";
type RemetenteTipo = "corretor" | "lead";
type CriterioKey = "fluxo" | "fluidez" | "cta" | "clareza" | "playbook";

interface Mensagem {
  id: string;
  conversa_id: string;
  remetente: RemetenteTipo;
  texto: string;
  enviada_em: string;
}

interface Conversa {
  id: string;
  lead_id: string;
  corretor_id: string;
  etapa_playbook: EtapaPlaybook | null;
  humano_assumiu_em: string | null;
  substituida_por_id: string | null;
}

interface ParametroCriterio {
  criterio: CriterioKey;
  nota_maxima: number;
  peso_percentual: number;
  descricao: string;
  ativo: boolean;
}

const MODEL = "gemini-2.5-flash";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";

function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas");
  }

  return createClient(url, key);
}

const ETAPA_LABEL: Record<EtapaPlaybook, string> = {
  primeiro_contato: "1º Contato",
  envio_simulacao: "Envio de Simulação",
  resultado_analise: "Resultado de Análise",
};

// Ver consolidarPorLead em sync-clint — junta as mensagens de todas as
// conversas do mesmo grupo (lead_id + corretor_id), não só a canônica.
async function buscarMensagensDoGrupo(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  conversa: Conversa,
): Promise<Mensagem[]> {
  const canonicaId = conversa.substituida_por_id ?? conversa.id;

  const { data: grupo } = await supabase
    .from("conversas")
    .select("id, humano_assumiu_em")
    .or(`id.eq.${canonicaId},substituida_por_id.eq.${canonicaId}`);

  const conversaIds = (grupo ?? []).map((c: { id: string }) => c.id);
  const handoffPorConversa = new Map((grupo ?? []).map((c: { id: string; humano_assumiu_em: string | null }) => [c.id, c.humano_assumiu_em]));

  const { data: todasMensagens } = await supabase
    .from("mensagens")
    .select("*")
    .in("conversa_id", conversaIds)
    .order("enviada_em", { ascending: true })
    .returns<Mensagem[]>();

  return (todasMensagens ?? []).filter((m) => {
    const handoff = handoffPorConversa.get(m.conversa_id);
    return !handoff || m.enviada_em > handoff;
  });
}

// Mesmo critério das outras functions do pipeline: o critério "playbook" é
// avaliado de forma fria e agnóstica de etapa — todos os playbooks ativos
// entram como referência, sem tentar adivinhar em qual etapa a conversa está.
async function buscarPlaybooksAtivos(
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<string> {
  const { data } = await supabase.from("playbooks").select("etapa, conteudo").eq("ativo", true);
  if (!data?.length) return "Nenhum playbook configurado — avalie com base nas boas práticas gerais de atendimento descritas no critério.";

  return data
    .map((p: { etapa: EtapaPlaybook; conteudo: string }) => `[${ETAPA_LABEL[p.etapa] ?? p.etapa}]\n${p.conteudo}`)
    .join("\n\n");
}

async function buscarParametrosAtivos(
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<ParametroCriterio[]> {
  const { data, error } = await supabase
    .from("parametros_analise")
    .select("criterio, nota_maxima, peso_percentual, descricao, ativo");

  if (error || !data?.length) {
    throw new Error(`parametros_analise vazio ou inacessível: ${error?.message ?? "sem registros"}`);
  }

  return data as ParametroCriterio[];
}

function criterioSchema(descricaoCriterio: string, notaMaxima: number) {
  return {
    type: "OBJECT",
    description: descricaoCriterio,
    properties: {
      score: { type: "INTEGER", description: `Nota de 0 (não atendeu) até ${notaMaxima} (atendeu plenamente).` },
      evidencia: { type: "STRING", description: "Trecho literal da conversa que embasa a nota." },
      justificativa: { type: "STRING", description: "1-2 frases explicando a nota." },
    },
    required: ["score", "evidencia", "justificativa"],
  };
}

// Monta o responseSchema a partir dos parâmetros configurados — critérios
// inativos simplesmente não entram no schema.
function montarAvaliacaoSchema(parametros: ParametroCriterio[]) {
  const ativos = parametros.filter((p) => p.ativo);
  if (!ativos.length) throw new Error("nenhum critério ativo em parametros_analise");

  // deno-lint-ignore no-explicit-any
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const p of ativos) {
    properties[p.criterio] = criterioSchema(p.descricao, p.nota_maxima);
    required.push(p.criterio);
  }

  properties.justificativa_geral = { type: "STRING", description: "Resumo de 2-3 frases sobre o atendimento como um todo." };
  required.push("justificativa_geral");

  return { type: "OBJECT", properties, required };
}

// Formato "inline request" da Gemini Batch API — um item por conversa, com
// `metadata.key` = conversa_id pra casar o resultado de volta depois (o
// Gemini ecoa esse key em cada resposta, confirmado em teste real).
function montarRequestInline(
  conversaId: string,
  mensagens: Mensagem[],
  playbook: string,
  // deno-lint-ignore no-explicit-any
  responseSchema: any,
) {
  const transcricao = mensagens
    .map((m) => `[${m.enviada_em}] ${m.remetente === "corretor" ? "Corretor" : "Lead"}: ${m.texto}`)
    .join("\n");

  const systemPrompt = `Você avalia atendimentos de corretores de crédito imobiliário no WhatsApp.

Playbooks configurados (técnicas/scripts de referência da imobiliária — não é
obrigatório que o corretor siga literalmente, mas devem ser usados como apoio
quando a conversa pede, ver critério "playbook" no schema para o julgamento
esperado):
"""
${playbook}
"""

Avalie a conversa abaixo estritamente contra os critérios do schema. Cite trechos
literais da conversa como evidência. Não invente informação que não está na conversa.`;

  return {
    request: {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: `Conversa a avaliar:\n\n${transcricao}` }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema },
    },
    metadata: { key: conversaId },
  };
}

// Limite de segurança — a Gemini Batch API aceita requests inline até 20MB
// no corpo total; conversas normais (poucas dezenas de mensagens) ficam bem
// abaixo disso mesmo em lotes de várias centenas. Se o volume diário crescer
// muito, pode ser necessário migrar pra upload de arquivo JSONL.
const MAX_CONVERSAS_POR_LOTE = 500;

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return new Response("GEMINI_API_KEY não configurada", { status: 500 });
  }

  const supabase = createServiceClient();

  const { data: pendentes, error: pendentesError } = await supabase
    .from("analises")
    .select("conversa_id")
    .eq("status", "pendente")
    .limit(MAX_CONVERSAS_POR_LOTE);

  if (pendentesError) {
    return new Response(`erro ao buscar pendentes: ${pendentesError.message}`, { status: 500 });
  }

  if (!pendentes?.length) {
    return new Response(JSON.stringify({ ok: true, enviados: 0, motivo: "nada pendente" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const conversaIds = pendentes.map((p: { conversa_id: string }) => p.conversa_id);

  const { data: conversas, error: conversasError } = await supabase
    .from("conversas")
    .select("id, lead_id, corretor_id, etapa_playbook, humano_assumiu_em, substituida_por_id")
    .in("id", conversaIds)
    .returns<Conversa[]>();

  if (conversasError || !conversas?.length) {
    return new Response(`erro ao buscar conversas: ${conversasError?.message}`, { status: 500 });
  }

  let responseSchema;
  try {
    const parametros = await buscarParametrosAtivos(supabase);
    responseSchema = montarAvaliacaoSchema(parametros);
  } catch (err) {
    return new Response(err instanceof Error ? err.message : String(err), { status: 500 });
  }

  // Mesmos playbooks pra todas as conversas do lote — busca uma vez só, fora do loop.
  const playbook = await buscarPlaybooksAtivos(supabase);

  const requests: unknown[] = [];
  const semMensagens: string[] = [];

  for (const conversa of conversas) {
    const mensagens = await buscarMensagensDoGrupo(supabase, conversa);
    if (mensagens.length === 0) {
      semMensagens.push(conversa.id);
      continue;
    }

    requests.push(montarRequestInline(conversa.id, mensagens, playbook, responseSchema));
  }

  if (semMensagens.length) {
    await supabase
      .from("analises")
      .update({ status: "falhou", erro: "conversa sem mensagens" })
      .in("conversa_id", semMensagens);
  }

  if (!requests.length) {
    return new Response(JSON.stringify({ ok: true, enviados: 0, motivo: "sem conversas com mensagens" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const resp = await fetch(`${GEMINI_API_URL}/models/${MODEL}:batchGenerateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      batch: {
        display_name: `analise-${new Date().toISOString().slice(0, 10)}`,
        input_config: { requests: { requests } },
      },
    }),
  });

  if (!resp.ok) {
    return new Response(`Gemini Batch API retornou ${resp.status}: ${await resp.text()}`, { status: 502 });
  }

  const batch = await resp.json();
  const batchName = batch.name as string; // ex: "batches/xxxxx"

  const { data: registroBatch, error: registroError } = await supabase
    .from("analise_batches")
    .insert({
      batch_id_externo: batchName,
      tipo: "analise",
      status: "in_progress",
      total_requests: requests.length,
    })
    .select("id")
    .single();

  if (registroError || !registroBatch) {
    return new Response(`batch enviado (${batchName}) mas falhou ao registrar: ${registroError?.message}`, {
      status: 500,
    });
  }

  const idsEnviados = conversas.filter((c) => !semMensagens.includes(c.id)).map((c) => c.id);
  await supabase
    .from("analises")
    .update({ status: "processando", batch_id: registroBatch.id })
    .in("conversa_id", idsEnviados);

  return new Response(
    JSON.stringify({
      ok: true,
      batch: batchName,
      enviados: requests.length,
      sem_mensagens: semMensagens.length,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
