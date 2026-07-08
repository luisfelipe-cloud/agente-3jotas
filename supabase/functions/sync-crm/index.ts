// Sincroniza leads/corretores do CRM para o Supabase.
// Disparo sugerido: pg_cron chamando esta function a cada N minutos
// (ver supabase/migrations para o agendamento, quando o CRM estiver confirmado).
//
// TODO: substituir a URL/headers e o mapeamento de campos assim que
// tivermos a documentação da API do CRM (item pendente no plano do projeto).

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
  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const crmBaseUrl = Deno.env.get("CRM_BASE_URL");
  const crmApiKey = Deno.env.get("CRM_API_KEY");

  if (!crmBaseUrl || !crmApiKey) {
    return new Response("CRM_BASE_URL / CRM_API_KEY não configuradas", { status: 500 });
  }

  const supabase = createServiceClient();

  // --- Corretores -----------------------------------------------------
  // const corretoresResp = await fetch(`${crmBaseUrl}/corretores`, {
  //   headers: { Authorization: `Bearer ${crmApiKey}` },
  // });
  // const corretoresCrm = await corretoresResp.json();
  //
  // for (const c of corretoresCrm) {
  //   await supabase.from("corretores").upsert(
  //     { crm_id: c.id, nome_crm: c.nome, ativo: c.ativo },
  //     { onConflict: "crm_id" },
  //   );
  // }

  // --- Leads ------------------------------------------------------------
  // const leadsResp = await fetch(`${crmBaseUrl}/leads?atualizadoDesde=...`, {
  //   headers: { Authorization: `Bearer ${crmApiKey}` },
  // });
  // const leadsCrm = await leadsResp.json();
  //
  // for (const l of leadsCrm) {
  //   await supabase.from("leads").upsert(
  //     { crm_id: l.id, telefone: l.telefone, nome_crm: l.nome },
  //     { onConflict: "crm_id" },
  //   );
  // }

  return new Response(JSON.stringify({ ok: true, sincronizados: 0 }), {
    headers: { "Content-Type": "application/json" },
  });
});
