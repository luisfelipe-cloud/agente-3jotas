// Analisa e pontua UMA conversa específica, na hora (chamada síncrona ao
// Gemini, sem passar pela Batch API) — botão "Analisar conversa" no
// dashboard, pra quando o corretor/gestor não quer esperar o lote noturno,
// ou como fallback manual se o pipeline em lote (analysis-batch-submit/poll)
// não rodar por algum motivo.
//
// Mesma lógica de contexto/critérios/playbooks do pipeline em lote
// (analysis-batch-submit) — só troca batchGenerateContent por
// generateContent (resposta na hora, sem polling).
//
// Disparo: POST { conversaId } com o mesmo CRON_SECRET das demais functions
// (a rota /api/conversas/[id]/analisar do dashboard repassa a chamada).

import { createClient } from "jsr:@supabase/supabase-js@2";

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
const CRITERIOS: CriterioKey[] = ["fluxo", "fluidez", "cta", "clareza", "playbook"];

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

// Idêntico ao buscarMensagensDoGrupo de analysis-batch-submit — junta as
// mensagens de todas as conversas do mesmo grupo consolidado (lead_id +
// corretor_id), não só a canônica, e corta tudo antes do handoff IA→humano.
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

function montarPrompt(mensagens: Mensagem[], playbook: string) {
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

  return { systemPrompt, transcricao };
}

// deno-lint-ignore no-explicit-any
function montarUpsertAnalise(conversaId: string, resultado: Record<string, any>) {
  // deno-lint-ignore no-explicit-any
  const upsert: Record<string, any> = {
    conversa_id: conversaId,
    status: "concluida" as const,
    justificativa_geral: resultado.justificativa_geral,
    modelo_usado: MODEL,
    erro: null,
    analisado_em: new Date().toISOString(),
    revisado: false,
    revisado_em: null,
    resumo_revisao: null,
  };

  for (const criterio of CRITERIOS) {
    const c = resultado[criterio];
    if (!c) continue;
    upsert[`${criterio}_score`] = c.score;
    upsert[`${criterio}_evidencia`] = c.evidencia;
    upsert[`${criterio}_justificativa`] = c.justificativa;
  }

  return upsert;
}

// deno-lint-ignore no-explicit-any
function montarUpsertBruta(conversaId: string, resultado: Record<string, any>) {
  // deno-lint-ignore no-explicit-any
  const upsert: Record<string, any> = {
    conversa_id: conversaId,
    justificativa_geral: resultado.justificativa_geral,
    modelo_usado: MODEL,
  };

  for (const criterio of CRITERIOS) {
    const c = resultado[criterio];
    if (!c) continue;
    upsert[`${criterio}_score`] = c.score;
    upsert[`${criterio}_evidencia`] = c.evidencia;
    upsert[`${criterio}_justificativa`] = c.justificativa;
  }

  return upsert;
}

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

  let conversaId: string | undefined;
  try {
    const body = await req.json();
    conversaId = body.conversaId;
  } catch {
    // segue com conversaId undefined, cai no 400 abaixo
  }

  if (!conversaId) {
    return new Response("body precisa de { conversaId }", { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: conversa, error: conversaError } = await supabase
    .from("conversas")
    .select("id, lead_id, corretor_id, etapa_playbook, humano_assumiu_em, substituida_por_id")
    .eq("id", conversaId)
    .maybeSingle<Conversa>();

  if (conversaError || !conversa) {
    return new Response(`conversa não encontrada: ${conversaError?.message ?? conversaId}`, { status: 404 });
  }

  await supabase.from("analises").upsert({ conversa_id: conversaId, status: "processando" }, { onConflict: "conversa_id" });

  try {
    const mensagens = await buscarMensagensDoGrupo(supabase, conversa);
    if (mensagens.length === 0) {
      await supabase
        .from("analises")
        .update({ status: "falhou", erro: "conversa sem mensagens" })
        .eq("conversa_id", conversaId);
      return new Response(JSON.stringify({ ok: false, erro: "conversa sem mensagens" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }

    const parametros = await buscarParametrosAtivos(supabase);
    const responseSchema = montarAvaliacaoSchema(parametros);
    const playbook = await buscarPlaybooksAtivos(supabase);
    const { systemPrompt, transcricao } = montarPrompt(mensagens, playbook);

    const resp = await fetch(`${GEMINI_API_URL}/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: `Conversa a avaliar:\n\n${transcricao}` }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema },
      }),
    });

    if (!resp.ok) {
      const erro = `Gemini API retornou ${resp.status}: ${await resp.text()}`;
      await supabase.from("analises").update({ status: "falhou", erro }).eq("conversa_id", conversaId);
      return new Response(JSON.stringify({ ok: false, erro }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!texto) {
      const erro = "resposta do Gemini sem texto (bloqueada ou vazia)";
      await supabase.from("analises").update({ status: "falhou", erro }).eq("conversa_id", conversaId);
      return new Response(JSON.stringify({ ok: false, erro }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    const resultado = JSON.parse(texto);

    await supabase.from("analises").upsert(montarUpsertAnalise(conversaId, resultado), { onConflict: "conversa_id" });
    await supabase.from("analises_bruta").upsert(montarUpsertBruta(conversaId, resultado), { onConflict: "conversa_id" });

    return new Response(JSON.stringify({ ok: true, conversaId }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const erro = err instanceof Error ? err.message : String(err);
    await supabase.from("analises").update({ status: "falhou", erro }).eq("conversa_id", conversaId);
    return new Response(JSON.stringify({ ok: false, erro }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
