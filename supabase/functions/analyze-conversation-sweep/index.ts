// Varre `analises` com status='pendente' e dispara analyze-conversation-sync
// (1º passe) pra cada uma — é a peça que falta entre "sync-clint marcou a
// conversa como pendente" e "a análise realmente roda". Sem isso, nada
// analisava automaticamente: só rodava via clique manual ou reanálise em lote.
//
// Disparo: cron, a cada poucos minutos (ver migration
// 0017_cron_analyze_conversation_sweep.sql). Também pode ser chamado na mão
// pra testar o pipeline ponta a ponta (botão "Buscar e analisar conversas"
// no dashboard chama sync-clint → este sweep → analyze-conversation-review,
// exatamente a mesma sequência que os crons rodam sozinhos).
//
// Arquivo único e autocontido (sem pasta _shared) para colar direto no editor
// do dashboard do Supabase. Lembre de desativar "Enforce JWT Verification"
// pra essa função, igual às outras disparadas por cron (Bearer CRON_SECRET).

import { createClient } from "jsr:@supabase/supabase-js@2";

// Quantas conversas pendentes processar por execução — cada uma é uma chamada
// a analyze-conversation-sync (que já faz sua própria chamada Gemini), então
// mantém baixo pra não estourar o timeout desta função.
const MAX_POR_EXECUCAO = 20;

function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas");
  }

  return createClient(url, key);
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas", { status: 500 });
  }

  const supabase = createServiceClient();

  const { data: pendentes, error: pendentesError } = await supabase
    .from("analises")
    .select("conversa_id")
    .eq("status", "pendente")
    .order("created_at", { ascending: true })
    .limit(MAX_POR_EXECUCAO);

  if (pendentesError) {
    return new Response(`erro ao buscar pendentes: ${pendentesError.message}`, { status: 500 });
  }

  if (!pendentes?.length) {
    return new Response(JSON.stringify({ ok: true, analisadas: 0, motivo: "nada pendente" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let ok = 0;
  const falhas: { conversa_id: string; erro: string }[] = [];

  for (const p of pendentes) {
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/analyze-conversation-sync`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ conversa_id: p.conversa_id }),
      });

      if (resp.ok) {
        ok++;
      } else {
        falhas.push({ conversa_id: p.conversa_id, erro: await resp.text() });
      }
    } catch (err) {
      falhas.push({ conversa_id: p.conversa_id, erro: err instanceof Error ? err.message : String(err) });
    }
  }

  return new Response(JSON.stringify({ ok: true, analisadas: ok, falhas, total: pendentes.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
