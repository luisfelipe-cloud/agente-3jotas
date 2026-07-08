// Junta todas as conversas com análise pendente e envia como um único job na
// Anthropic Message Batches API — custa 50% do preço da chamada síncrona.
// Resultados não saem na hora: ver analysis-batch-poll para buscá-los depois.
//
// Disparo sugerido: pg_cron uma vez por noite (ex: 2h da manhã), autenticado
// com o mesmo CRON_SECRET usado em sync-crm.

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
  canal: string;
  etapa_playbook: EtapaPlaybook | null;
  iniciada_em: string;
  finalizada_em: string | null;
  humano_assumiu_em: string | null;
}

interface ParametroCriterio {
  criterio: CriterioKey;
  nota_maxima: number;
  peso_percentual: number;
  descricao: string;
  ativo: boolean;
}

const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_BATCHES_URL = "https://api.anthropic.com/v1/messages/batches";
const ANTHROPIC_VERSION = "2023-06-01";

function criterioSchema(descricaoCriterio: string, notaMaxima: number) {
  return {
    type: "object",
    description: descricaoCriterio,
    properties: {
      score: {
        type: "integer",
        minimum: 0,
        maximum: notaMaxima,
        description: `0=não atendeu ... ${notaMaxima}=atendeu plenamente`,
      },
      evidencia: { type: "string", description: "Trecho literal da conversa que embasa a nota." },
      justificativa: { type: "string", description: "1-2 frases explicando a nota." },
    },
    required: ["score", "evidencia", "justificativa"],
  };
}

// Monta a tool a partir dos parâmetros configurados (aba Configurações do
// dashboard) — critérios inativos simplesmente não entram no schema.
function montarAvaliacaoTool(parametros: ParametroCriterio[]) {
  const ativos = parametros.filter((p) => p.ativo);
  if (!ativos.length) throw new Error("nenhum critério ativo em parametros_analise");

  // deno-lint-ignore no-explicit-any
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const p of ativos) {
    properties[p.criterio] = criterioSchema(p.descricao, p.nota_maxima);
    required.push(p.criterio);
  }

  properties.justificativa_geral = {
    type: "string",
    description: "Resumo de 2-3 frases sobre o atendimento como um todo.",
  };
  required.push("justificativa_geral");

  return {
    name: "registrar_avaliacao",
    description: "Registra a avaliação da conversa segundo os critérios configurados do playbook.",
    input_schema: { type: "object", properties, required },
  };
}

function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas");
  }

  return createClient(url, key);
}

async function buscarPlaybookAtivo(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  etapa: EtapaPlaybook | null,
): Promise<string> {
  if (!etapa) return "Etapa da conversa não identificada — avalie com base nas boas práticas gerais de atendimento descritas nos critérios.";

  const { data, error } = await supabase
    .from("playbooks")
    .select("conteudo")
    .eq("etapa", etapa)
    .eq("ativo", true)
    .single();

  if (error || !data) {
    throw new Error(`playbook ativo não encontrado para etapa "${etapa}": ${error?.message ?? "sem registro"}`);
  }

  return data.conteudo as string;
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

function montarRequestBody(
  conversa: Conversa,
  mensagens: Mensagem[],
  playbook: string,
  // deno-lint-ignore no-explicit-any
  avaliacaoTool: any,
) {
  const transcricao = mensagens
    .map((m) => `[${m.enviada_em}] ${m.remetente === "corretor" ? "Corretor" : "Lead"}: ${m.texto}`)
    .join("\n");

  const systemPrompt = `Você avalia atendimentos de corretores de crédito imobiliário no WhatsApp.

Script/playbook aplicável à etapa "${conversa.etapa_playbook ?? "desconhecida"}":
"""
${playbook}
"""

Avalie a conversa abaixo estritamente contra os critérios do schema. Cite trechos
literais da conversa como evidência. Não invente informação que não está na conversa.`;

  return {
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: `Conversa a avaliar:\n\n${transcricao}` }],
    tools: [avaliacaoTool],
    tool_choice: { type: "tool", name: "registrar_avaliacao" },
  };
}

// Limite de segurança por execução — a API aceita até 100.000 requests/256MB
// por batch, mas manter os lotes menores facilita reprocessar em caso de erro.
const MAX_CONVERSAS_POR_LOTE = 500;

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response("ANTHROPIC_API_KEY não configurada", { status: 500 });
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

  const conversaIds = pendentes.map((p) => p.conversa_id as string);

  const { data: conversas, error: conversasError } = await supabase
    .from("conversas")
    .select("*")
    .in("id", conversaIds)
    .returns<Conversa[]>();

  if (conversasError || !conversas?.length) {
    return new Response(`erro ao buscar conversas: ${conversasError?.message}`, { status: 500 });
  }

  const { data: todasMensagens, error: mensagensError } = await supabase
    .from("mensagens")
    .select("*")
    .in("conversa_id", conversaIds)
    .order("enviada_em", { ascending: true })
    .returns<Mensagem[]>();

  if (mensagensError) {
    return new Response(`erro ao buscar mensagens: ${mensagensError.message}`, { status: 500 });
  }

  const mensagensPorConversa = new Map<string, Mensagem[]>();
  for (const m of todasMensagens ?? []) {
    const lista = mensagensPorConversa.get(m.conversa_id) ?? [];
    lista.push(m);
    mensagensPorConversa.set(m.conversa_id, lista);
  }

  let avaliacaoTool;
  try {
    const parametros = await buscarParametrosAtivos(supabase);
    avaliacaoTool = montarAvaliacaoTool(parametros);
  } catch (err) {
    return new Response(err instanceof Error ? err.message : String(err), { status: 500 });
  }

  // Cache de playbook por etapa — evita repetir a query para cada conversa da mesma etapa.
  const playbookCache = new Map<string, string>();

  const requests: { custom_id: string; params: unknown }[] = [];
  const semMensagens: string[] = [];

  for (const conversa of conversas) {
    const todasDaConversa = mensagensPorConversa.get(conversa.id) ?? [];
    // Se um agente de IA qualificou o lead antes do corretor humano entrar,
    // tudo até o handoff fica de fora — não é atendimento do corretor.
    const mensagens = conversa.humano_assumiu_em
      ? todasDaConversa.filter((m) => m.enviada_em > conversa.humano_assumiu_em!)
      : todasDaConversa;
    if (mensagens.length === 0) {
      semMensagens.push(conversa.id);
      continue;
    }

    const chaveEtapa = conversa.etapa_playbook ?? "__sem_etapa__";
    let playbook = playbookCache.get(chaveEtapa);
    if (playbook === undefined) {
      playbook = await buscarPlaybookAtivo(supabase, conversa.etapa_playbook);
      playbookCache.set(chaveEtapa, playbook);
    }

    requests.push({
      custom_id: conversa.id,
      params: montarRequestBody(conversa, mensagens, playbook, avaliacaoTool),
    });
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

  const resp = await fetch(ANTHROPIC_BATCHES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({ requests }),
  });

  if (!resp.ok) {
    return new Response(`Anthropic Batches API retornou ${resp.status}: ${await resp.text()}`, { status: 502 });
  }

  const batch = await resp.json();

  const { data: registroBatch, error: registroError } = await supabase
    .from("analise_batches")
    .insert({
      batch_id_anthropic: batch.id,
      status: "in_progress",
      total_requests: requests.length,
    })
    .select("id")
    .single();

  if (registroError || !registroBatch) {
    return new Response(`batch enviado (${batch.id}) mas falhou ao registrar: ${registroError?.message}`, {
      status: 500,
    });
  }

  const idsEnviados = requests.map((r) => r.custom_id);
  await supabase
    .from("analises")
    .update({ status: "processando", batch_id: registroBatch.id })
    .in("conversa_id", idsEnviados);

  return new Response(
    JSON.stringify({
      ok: true,
      batch_id_anthropic: batch.id,
      enviados: requests.length,
      sem_mensagens: semMensagens.length,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
