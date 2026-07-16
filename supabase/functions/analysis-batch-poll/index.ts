// Verifica o status dos lotes em andamento na Gemini Batch API (não há
// webhook de conclusão — só polling) e, quando um lote termina, grava os
// resultados em `analises`, casando pelo `metadata.key` de cada resposta
// (= conversa_id, confirmado em teste real que a Gemini ecoa esse campo
// mesmo em batch inline).
//
// Quando um lote do tipo 'analise' (1º passe) termina com sucesso, encadeia
// automaticamente a submissão de um lote 'revisao' (2º passe) só com as
// conversas que concluíram — assim o fluxo completo roda sozinho de
// madrugada, sem precisar de um cron dedicado pra revisão (o antigo
// analyze-conversation-review, em tempo real, foi desligado — ver migration
// 0024).
//
// Disparo sugerido: pg_cron a cada 5-10 minutos, mesmo CRON_SECRET dos
// demais crons.

import { createClient } from "jsr:@supabase/supabase-js@2";

// Arquivo único e autocontido (sem pasta _shared) para colar direto no editor
// do dashboard do Supabase.

type EtapaPlaybook = "primeiro_contato" | "envio_simulacao" | "resultado_analise";
type RemetenteTipo = "corretor" | "lead";
type CriterioKey = "fluxo" | "fluidez" | "cta" | "clareza" | "playbook";

const CRITERIOS: CriterioKey[] = ["fluxo", "fluidez", "cta", "clareza", "playbook"];

const CRITERIO_LABEL: Record<CriterioKey, string> = {
  fluxo: "Fluxo Ligação/Mensagem",
  fluidez: "Fluidez",
  cta: "CTA",
  clareza: "Clareza da Informação",
  playbook: "Aderência ao Playbook",
};

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
  const { data } = await supabase.from("parametros_analise").select("criterio, nota_maxima, peso_percentual, descricao, ativo");
  return (data ?? []) as ParametroCriterio[];
}

function criterioRevisaoSchema(descricaoCriterio: string, notaMaxima: number) {
  return {
    type: "OBJECT",
    description: descricaoCriterio,
    properties: {
      score: { type: "INTEGER", description: `Nota revisada de 0 (não atendeu) até ${notaMaxima} (atendeu plenamente).` },
      evidencia: { type: "STRING", description: "Trecho literal da conversa que embasa a nota revisada." },
      justificativa: { type: "STRING", description: "1-2 frases explicando a nota revisada." },
      mudou: { type: "BOOLEAN", description: "true se essa nota mudou em relação à avaliação original." },
    },
    required: ["score", "evidencia", "justificativa", "mudou"],
  };
}

function montarRevisaoSchema(parametrosAtivos: ParametroCriterio[]) {
  // deno-lint-ignore no-explicit-any
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const p of parametrosAtivos) {
    properties[p.criterio] = criterioRevisaoSchema(p.descricao, p.nota_maxima);
    required.push(p.criterio);
  }

  properties.resumo_revisao = {
    type: "STRING",
    description: "2-3 frases resumindo o que mudou nesta revisão e por quê, ou explicando que a avaliação original já estava correta e nada mudou.",
  };
  required.push("resumo_revisao");

  return { type: "OBJECT", properties, required };
}

// deno-lint-ignore no-explicit-any
function montarUpsertAnalise(conversaId: string, resultado: Record<string, any>, loteId: string) {
  // deno-lint-ignore no-explicit-any
  const upsert: Record<string, any> = {
    conversa_id: conversaId,
    status: "concluida" as const,
    justificativa_geral: resultado.justificativa_geral,
    modelo_usado: MODEL,
    erro: null,
    analisado_em: new Date().toISOString(),
    // Reanálise (chegou msg nova numa conversa já com lote antigo) invalida
    // qualquer revisão anterior — mesmo raciocínio do sync-clint.
    revisado: false,
    revisado_em: null,
    resumo_revisao: null,
    batch_id: loteId,
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

// deno-lint-ignore no-explicit-any
function montarUpsertRevisao(conversaId: string, revisao: Record<string, any>, ativos: ParametroCriterio[], loteId: string) {
  // deno-lint-ignore no-explicit-any
  const upsert: Record<string, any> = {
    conversa_id: conversaId,
    revisado: true,
    revisado_em: new Date().toISOString(),
    resumo_revisao: revisao.resumo_revisao ?? null,
    batch_id: loteId,
  };

  for (const p of ativos) {
    const c = revisao[p.criterio];
    if (!c) continue;
    upsert[`${p.criterio}_score`] = c.score;
    upsert[`${p.criterio}_evidencia`] = c.evidencia;
    upsert[`${p.criterio}_justificativa`] = c.justificativa;
  }

  return upsert;
}

interface ItemResultado {
  metadata?: { key?: string };
  response?: { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  error?: unknown;
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

  const supabase = createServiceClient();

  const { data: lotesEmAndamento, error: lotesError } = await supabase
    .from("analise_batches")
    .select("id, batch_id_externo, tipo")
    .eq("status", "in_progress");

  if (lotesError) {
    return new Response(`erro ao buscar lotes: ${lotesError.message}`, { status: 500 });
  }

  if (!lotesEmAndamento?.length) {
    return new Response(JSON.stringify({ ok: true, verificados: 0, concluidos: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let concluidos = 0;
  const detalhes: Record<string, string> = {};

  for (const lote of lotesEmAndamento) {
    const statusResp = await fetch(`${GEMINI_API_URL}/${lote.batch_id_externo}`, {
      headers: { "x-goog-api-key": apiKey },
    });

    if (!statusResp.ok) {
      detalhes[lote.batch_id_externo] = `erro ao consultar status: ${statusResp.status}`;
      continue;
    }

    // deno-lint-ignore no-explicit-any
    const batch: any = await statusResp.json();
    const estado = batch.metadata?.state as string | undefined;

    if (!batch.done || estado === "BATCH_STATE_PENDING" || estado === "BATCH_STATE_RUNNING") {
      detalhes[lote.batch_id_externo] = `ainda em andamento (${estado ?? "desconhecido"})`;
      continue;
    }

    if (estado !== "BATCH_STATE_SUCCEEDED") {
      await supabase.from("analises").update({ status: "falhou", erro: `lote ${estado}` }).eq("batch_id", lote.id);
      await supabase
        .from("analise_batches")
        .update({ status: "falhou", erro: estado, concluido_em: new Date().toISOString() })
        .eq("id", lote.id);
      detalhes[lote.batch_id_externo] = `falhou: ${estado}`;
      continue;
    }

    try {
      const itens = (batch.response?.inlinedResponses?.inlinedResponses ?? []) as ItemResultado[];
      let succeeded = 0;
      let errored = 0;

      if (lote.tipo === "analise") {
        const idsConcluidos: string[] = [];

        for (const item of itens) {
          const conversaId = item.metadata?.key;
          if (!conversaId) continue;

          const texto = item.response?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!texto) {
            await supabase.from("analises").upsert(
              { conversa_id: conversaId, status: "falhou", erro: `sem resposta no lote: ${JSON.stringify(item.error ?? "desconhecido")}`, batch_id: lote.id },
              { onConflict: "conversa_id" },
            );
            errored++;
            continue;
          }

          try {
            const resultado = JSON.parse(texto);
            await supabase.from("analises").upsert(montarUpsertAnalise(conversaId, resultado, lote.id), { onConflict: "conversa_id" });
            await supabase.from("analises_bruta").upsert(montarUpsertBruta(conversaId, resultado), { onConflict: "conversa_id" });
            idsConcluidos.push(conversaId);
            succeeded++;
          } catch (err) {
            await supabase.from("analises").upsert(
              { conversa_id: conversaId, status: "falhou", erro: `parsing: ${err instanceof Error ? err.message : String(err)}`, batch_id: lote.id },
              { onConflict: "conversa_id" },
            );
            errored++;
          }
        }

        // Encadeia o 2º passe automaticamente — sem depender de nenhum cron
        // separado pra revisão acontecer.
        if (idsConcluidos.length) {
          await submeterLoteRevisao(supabase, apiKey, idsConcluidos);
        }
      } else {
        // tipo === "revisao"
        const parametros = await buscarParametrosAtivos(supabase);
        const ativos = parametros.filter((p) => p.ativo);

        for (const item of itens) {
          const conversaId = item.metadata?.key;
          if (!conversaId) continue;

          const texto = item.response?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!texto) {
            await supabase.from("analises").upsert(
              {
                conversa_id: conversaId,
                revisado: true,
                revisado_em: new Date().toISOString(),
                resumo_revisao: "Não revisada: sem resposta no lote de revisão.",
                batch_id: lote.id,
              },
              { onConflict: "conversa_id" },
            );
            errored++;
            continue;
          }

          try {
            const revisao = JSON.parse(texto);
            await supabase.from("analises").upsert(montarUpsertRevisao(conversaId, revisao, ativos, lote.id), { onConflict: "conversa_id" });
            succeeded++;
          } catch (err) {
            await supabase.from("analises").upsert(
              {
                conversa_id: conversaId,
                revisado: true,
                revisado_em: new Date().toISOString(),
                resumo_revisao: `Não revisada: parsing falhou (${err instanceof Error ? err.message : String(err)}).`,
                batch_id: lote.id,
              },
              { onConflict: "conversa_id" },
            );
            errored++;
          }
        }
      }

      await supabase
        .from("analise_batches")
        .update({ status: "ended", concluido_em: new Date().toISOString(), succeeded_count: succeeded, errored_count: errored })
        .eq("id", lote.id);

      concluidos++;
      detalhes[lote.batch_id_externo] = `concluído (${lote.tipo}): ${succeeded} ok, ${errored} com erro`;
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      await supabase
        .from("analise_batches")
        .update({ status: "falhou", erro: mensagem, concluido_em: new Date().toISOString() })
        .eq("id", lote.id);
      detalhes[lote.batch_id_externo] = `falhou: ${mensagem}`;
    }
  }

  return new Response(JSON.stringify({ ok: true, verificados: lotesEmAndamento.length, concluidos, detalhes }), {
    headers: { "Content-Type": "application/json" },
  });
});

// Monta e envia um novo lote (tipo 'revisao') pras conversas que acabaram de
// concluir o 1º passe com sucesso — é isso que faz o 2º passe acontecer
// sozinho, sem precisar de um cron dedicado só pra revisão.
async function submeterLoteRevisao(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  apiKey: string,
  conversaIds: string[],
): Promise<void> {
  const { data: conversas } = await supabase
    .from("conversas")
    .select("id, lead_id, corretor_id, etapa_playbook, humano_assumiu_em, substituida_por_id")
    .in("id", conversaIds)
    .returns<Conversa[]>();

  if (!conversas?.length) return;

  const { data: brutas } = await supabase.from("analises_bruta").select("*").in("conversa_id", conversaIds);
  const brutaPorConversa = new Map((brutas ?? []).map((b: { conversa_id: string }) => [b.conversa_id, b]));

  const parametros = await buscarParametrosAtivos(supabase);
  const ativos = parametros.filter((p) => p.ativo);
  if (!ativos.length) return;

  const playbook = await buscarPlaybooksAtivos(supabase);
  const responseSchema = montarRevisaoSchema(ativos);

  const requests: unknown[] = [];
  const semBruta: string[] = [];

  for (const conversa of conversas) {
    // deno-lint-ignore no-explicit-any
    const bruta = brutaPorConversa.get(conversa.id) as any;
    if (!bruta) {
      semBruta.push(conversa.id);
      continue;
    }

    const mensagens = await buscarMensagensDoGrupo(supabase, conversa);
    if (!mensagens.length) {
      semBruta.push(conversa.id);
      continue;
    }

    const avaliacaoOriginal = ativos
      .map((p) => {
        const score = bruta[`${p.criterio}_score`];
        const evidencia = bruta[`${p.criterio}_evidencia`];
        const justificativa = bruta[`${p.criterio}_justificativa`];
        if (score === null || score === undefined) return null;
        return `- ${CRITERIO_LABEL[p.criterio]} (instrução: "${p.descricao}"): nota ${score}/${p.nota_maxima} — evidência citada: "${evidencia}" — justificativa: "${justificativa}"`;
      })
      .filter(Boolean)
      .join("\n");

    if (!avaliacaoOriginal) {
      semBruta.push(conversa.id);
      continue;
    }

    const transcricao = mensagens
      .map((m) => `[${m.enviada_em}] ${m.remetente === "corretor" ? "Corretor" : "Lead"}: ${m.texto}`)
      .join("\n");

    const systemPrompt = `Você é um revisor sênior de QA, mais experiente que o avaliador que fez a primeira passada desta conversa.

Playbooks configurados (técnicas/scripts de referência da imobiliária — ver
critério "playbook" no schema para o julgamento esperado, que é frio e
agnóstico de etapa):
"""
${playbook}
"""

A primeira avaliação (feita critério a critério, isoladamente) resultou em:
${avaliacaoOriginal}

Releia a conversa completa abaixo prestando atenção a nuances que uma avaliação
isolada por critério pode perder: ironia ou sarcasmo, o corretor recuperando
uma falha mais tarde na conversa, gírias e expressões regionais, mudança de
tom do lead ao longo do atendimento, contexto que só faz sentido lendo tudo
junto. Ajuste a nota, evidência e justificativa de cada critério apenas onde a
avaliação original estiver de fato equivocada — mantenha a nota original
quando ela já estiver correta, mesmo que a evidência citada não seja o único
trecho relevante. Não mude uma nota só para ser diferente da original.`;

    requests.push({
      request: {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: `Conversa completa:\n\n${transcricao}` }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema },
      },
      metadata: { key: conversa.id },
    });
  }

  if (semBruta.length) {
    await supabase.from("analises").upsert(
      semBruta.map((id) => ({
        conversa_id: id,
        revisado: true,
        revisado_em: new Date().toISOString(),
        resumo_revisao: "Não revisada: sem análise crua ou mensagens pra revisar.",
      })),
      { onConflict: "conversa_id" },
    );
  }

  if (!requests.length) return;

  const resp = await fetch(`${GEMINI_API_URL}/models/${MODEL}:batchGenerateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      batch: {
        display_name: `revisao-${new Date().toISOString().slice(0, 10)}`,
        input_config: { requests: { requests } },
      },
    }),
  });

  if (!resp.ok) {
    console.error(`falha ao submeter lote de revisão: ${resp.status} ${await resp.text()}`);
    return;
  }

  const batch = await resp.json();

  const { data: registroBatch } = await supabase
    .from("analise_batches")
    .insert({ batch_id_externo: batch.name, tipo: "revisao", status: "in_progress", total_requests: requests.length })
    .select("id")
    .single();

  if (registroBatch) {
    const idsComRequest = conversas.filter((c) => !semBruta.includes(c.id)).map((c) => c.id);
    await supabase.from("analises").update({ batch_id: registroBatch.id }).in("conversa_id", idsComRequest);
  }
}
