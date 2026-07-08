// Verifica o status dos lotes em andamento (não há webhook de conclusão na
// Batches API — só polling) e, quando um lote termina, baixa os resultados e
// grava cada um em `analises`, casando pelo custom_id (= conversa_id).
//
// Disparo sugerido: pg_cron a cada 5-10 minutos, mesmo CRON_SECRET dos demais crons.

import { createClient } from "jsr:@supabase/supabase-js@2";

// Arquivo único e autocontido (sem pasta _shared) para colar direto no editor
// do dashboard do Supabase.

type CriterioKey = "fluxo" | "fluidez" | "cta" | "clareza" | "playbook";

const CRITERIOS: CriterioKey[] = ["fluxo", "fluidez", "cta", "clareza", "playbook"];

const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_BATCHES_URL = "https://api.anthropic.com/v1/messages/batches";
const ANTHROPIC_VERSION = "2023-06-01";

function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas");
  }

  return createClient(url, key);
}

// deno-lint-ignore no-explicit-any
function extrairResultado(content: any[]): Record<string, any> {
  const toolUse = content?.find((c: { type: string }) => c.type === "tool_use");
  if (!toolUse) throw new Error("resposta da Claude não trouxe tool_use");
  return toolUse.input;
}

// Só grava colunas dos critérios que de fato vieram na resposta (ou seja, que
// estavam ativos em parametros_analise no momento do envio do lote).
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

interface BatchResultLine {
  custom_id: string;
  result:
    | { type: "succeeded"; message: { content: unknown[] } }
    | { type: "errored"; error: { type: string; message?: string } }
    | { type: "canceled" }
    | { type: "expired" };
}

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

  const { data: lotesEmAndamento, error: lotesError } = await supabase
    .from("analise_batches")
    .select("id, batch_id_anthropic")
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
    const statusResp = await fetch(`${ANTHROPIC_BATCHES_URL}/${lote.batch_id_anthropic}`, {
      headers: { "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION },
    });

    if (!statusResp.ok) {
      detalhes[lote.batch_id_anthropic] = `erro ao consultar status: ${statusResp.status}`;
      continue;
    }

    const batch = await statusResp.json();

    if (batch.processing_status !== "ended") {
      detalhes[lote.batch_id_anthropic] = `ainda em andamento (${batch.processing_status})`;
      continue;
    }

    try {
      const { succeeded, errored } = await processarResultados(supabase, lote.id, lote.batch_id_anthropic, apiKey);

      await supabase
        .from("analise_batches")
        .update({
          status: "ended",
          concluido_em: new Date().toISOString(),
          succeeded_count: succeeded,
          errored_count: errored,
        })
        .eq("id", lote.id);

      concluidos++;
      detalhes[lote.batch_id_anthropic] = `concluído: ${succeeded} ok, ${errored} com erro`;
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      await supabase
        .from("analise_batches")
        .update({ status: "falhou", erro: mensagem, concluido_em: new Date().toISOString() })
        .eq("id", lote.id);
      detalhes[lote.batch_id_anthropic] = `falhou: ${mensagem}`;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, verificados: lotesEmAndamento.length, concluidos, detalhes }),
    { headers: { "Content-Type": "application/json" } },
  );
});

async function processarResultados(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  loteId: string,
  batchIdAnthropic: string,
  apiKey: string,
): Promise<{ succeeded: number; errored: number }> {
  const resultsResp = await fetch(`${ANTHROPIC_BATCHES_URL}/${batchIdAnthropic}/results`, {
    headers: { "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION },
  });

  if (!resultsResp.ok) {
    throw new Error(`erro ao baixar resultados: ${resultsResp.status} ${await resultsResp.text()}`);
  }

  const corpo = await resultsResp.text();
  const linhas = corpo.split("\n").map((l) => l.trim()).filter(Boolean);

  let succeeded = 0;
  let errored = 0;

  for (const linha of linhas) {
    const item = JSON.parse(linha) as BatchResultLine;
    const conversaId = item.custom_id;

    if (item.result.type === "succeeded") {
      try {
        const resultado = extrairResultado(item.result.message.content as never[]);
        await supabase.from("analises").upsert(
          { ...montarUpsertAnalise(conversaId, resultado), batch_id: loteId },
          { onConflict: "conversa_id" },
        );
        succeeded++;
      } catch (err) {
        const mensagem = err instanceof Error ? err.message : String(err);
        await supabase.from("analises").upsert(
          { conversa_id: conversaId, status: "falhou", erro: `parsing: ${mensagem}`, batch_id: loteId, modelo_usado: MODEL },
          { onConflict: "conversa_id" },
        );
        errored++;
      }
      continue;
    }

    const erro =
      item.result.type === "errored"
        ? `${item.result.error.type}: ${item.result.error.message ?? ""}`
        : item.result.type; // "canceled" | "expired"

    await supabase.from("analises").upsert(
      { conversa_id: conversaId, status: "falhou", erro, batch_id: loteId },
      { onConflict: "conversa_id" },
    );
    errored++;
  }

  return { succeeded, errored };
}
