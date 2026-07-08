// Recebe/normaliza conversas do WhatsApp e grava em `conversas` + `mensagens`.
// Disparo sugerido: webhook do provedor (ideal, baixa latência) apontando
// direto para esta function. Se o provedor não suportar webhook, cair para
// um cron incremental como o sync-crm.
//
// TODO: confirmar provedor (UazAPI ou outro) e ajustar payload/assinatura
// do webhook (item pendente no plano do projeto).

import { createClient } from "jsr:@supabase/supabase-js@2";

// Edge Functions rodam com a service_role key por padrão (SUPABASE_SERVICE_ROLE_KEY
// é injetada automaticamente pelo runtime), então essas chamadas ignoram RLS.
function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas");
  }

  return createClient(url, key);
}

Deno.serve(async (req) => {
  // Validar assinatura/segredo do provedor de WhatsApp antes de processar.
  const webhookSecret = Deno.env.get("WHATSAPP_WEBHOOK_SECRET");
  const signature = req.headers.get("x-webhook-signature");
  if (!webhookSecret || signature !== webhookSecret) {
    return new Response("unauthorized", { status: 401 });
  }

  const payload = await req.json();
  const supabase = createServiceClient();

  // --- Mapeamento do payload do provedor (ajustar conforme confirmado) ---
  // const { telefone, corretorCrmId, mensagem, enviadaEm, direcao } = payload;
  //
  // const { data: lead } = await supabase
  //   .from("leads")
  //   .select("id")
  //   .eq("telefone", telefone)
  //   .single();
  //
  // const { data: corretor } = await supabase
  //   .from("corretores")
  //   .select("id")
  //   .eq("crm_id", corretorCrmId)
  //   .single();
  //
  // if (!lead || !corretor) {
  //   return new Response("lead ou corretor não encontrado", { status: 422 });
  // }
  //
  // Busca conversa em aberto ou cria uma nova.
  // const { data: conversa } = await supabase
  //   .from("conversas")
  //   .select("id")
  //   .eq("lead_id", lead.id)
  //   .eq("corretor_id", corretor.id)
  //   .is("finalizada_em", null)
  //   .maybeSingle();
  //
  // let conversaId = conversa?.id;
  // if (!conversaId) {
  //   const { data: novaConversa } = await supabase
  //     .from("conversas")
  //     .insert({ lead_id: lead.id, corretor_id: corretor.id, iniciada_em: enviadaEm })
  //     .select("id")
  //     .single();
  //   conversaId = novaConversa!.id;
  // }
  //
  // await supabase.from("mensagens").insert({
  //   conversa_id: conversaId,
  //   remetente: direcao === "outbound" ? "corretor" : "lead",
  //   texto: mensagem,
  //   enviada_em: enviadaEm,
  // });
  //
  // Enfileira a conversa para análise (cria/reseta o registro em `analises`).
  // await supabase.from("analises").upsert(
  //   { conversa_id: conversaId, status: "pendente" },
  //   { onConflict: "conversa_id" },
  // );

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
