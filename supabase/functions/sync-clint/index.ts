// Sincroniza conversas e mensagens do Clint (CRM/WhatsApp) para o Supabase.
//
// Cadeia de descoberta (a API do Clint não tem "listar tudo" sem filtro):
//   GET /v2/channel-accounts                            → contas conectadas
//   GET /v2/chats/channel-account/{channelAccountId}     → chats de cada conta
//   GET /v2/messages/chat/{chatId}                       → mensagens de cada chat
//
// Escopo: só o dia de hoje (00:00 UTC até agora) — não faz backfill de
// histórico. Roda de novo a cada execução sobre a mesma janela; os upserts
// são idempotentes (crm_conversa_id/crm_mensagem_id), então reprocessar o dia
// não duplica nada. Ao final de cada conversa com mensagem nova, marca
// `analises.status = pendente` para entrar na fila do motor de análise
// (analysis-batch-submit).
//
// Disparo sugerido: pg_cron a cada N minutos, mesmo CRON_SECRET dos demais crons.

import { createClient } from "jsr:@supabase/supabase-js@2";

// Arquivo único e autocontido (sem pasta _shared) para colar direto no editor
// do dashboard do Supabase.

function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas");
  }

  return createClient(url, key);
}

// --- Client mínimo para a API do Clint (CRM/WhatsApp) -----------------------
// Só o necessário para listar canais, chats e mensagens (paginação
// PaginatedV2: page/limit/has_next).

interface ClintChannelAccount {
  id: string;
  name: string;
  type: "WHATSAPP_OFFICIAL" | "WHATSAPP" | "INSTAGRAM";
  status: "CONNECTED" | "DISCONNECTED" | "CANCELLED";
  identifier: string | null;
}

interface ClintChat {
  id: string;
  created_at: string;
  contact_id: string;
  user_id: string;
  status: string;
  closed_at: string | null;
  channel_account_id: string;
}

interface ClintMessage {
  id: string;
  created_at: string;
  chat_id: string | null;
  content: string;
  type: "USER" | "CUSTOMER" | "EVENT" | "NOTE";
  content_type: string;
}

interface PaginatedResponse<T> {
  data: T[];
  has_next: boolean;
}

function createClintClient() {
  const apiKey = Deno.env.get("CLINT_API_KEY");
  const baseUrl = Deno.env.get("CLINT_BASE_URL") ?? "https://api.clint.digital";
  if (!apiKey) throw new Error("CLINT_API_KEY não configurada");

  async function listarTudo<T>(path: string, params: Record<string, string | undefined> = {}): Promise<T[]> {
    const itens: T[] = [];
    let page = 1;
    const limit = 200;

    while (true) {
      const url = new URL(`${baseUrl}${path}`);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(limit));
      for (const [chave, valor] of Object.entries(params)) {
        if (valor) url.searchParams.set(chave, valor);
      }

      const resp = await fetch(url, { headers: { "api-token": apiKey! } });
      if (!resp.ok) {
        throw new Error(`Clint API ${path} retornou ${resp.status}: ${await resp.text()}`);
      }

      const body = (await resp.json()) as PaginatedResponse<T>;
      itens.push(...body.data);

      if (!body.has_next || body.data.length === 0) break;
      page++;
    }

    return itens;
  }

  return {
    listarContas: (params: Record<string, string | undefined> = {}) =>
      listarTudo<ClintChannelAccount>("/v2/channel-accounts", params),
    listarChatsDaConta: (channelAccountId: string, params: Record<string, string | undefined> = {}) =>
      listarTudo<ClintChat>(`/v2/chats/channel-account/${channelAccountId}`, params),
    listarMensagensDoChat: (chatId: string, params: Record<string, string | undefined> = {}) =>
      listarTudo<ClintMessage>(`/v2/messages/chat/${chatId}`, params),
  };
}

// Limite de segurança por execução — mesmo escopo sendo só "hoje", um dia
// de pico pode ter muitos chats; corta aqui para não estourar o limite de
// recursos da Edge Function (WORKER_RESOURCE_LIMIT). Se truncar, a próxima
// execução (cron ou botão) reprocessa o dia inteiro de novo — inofensivo,
// os upserts são idempotentes por crm_conversa_id/crm_mensagem_id.
const MAX_CHATS_POR_EXECUCAO = 100;

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();
  let clint;
  try {
    clint = createClintClient();
  } catch (err) {
    return new Response(err instanceof Error ? err.message : String(err), { status: 500 });
  }

  const inicioHoje = new Date();
  inicioHoje.setUTCHours(0, 0, 0, 0);
  const cursor = inicioHoje.toISOString();

  let chatsProcessados = 0;
  let mensagensGravadas = 0;
  let truncado = false;
  const erros: string[] = [];

  try {
    const contas = await clint.listarContas();

    contasLoop: for (const conta of contas) {
      if (conta.status !== "CONNECTED") continue;

      const chats = await clint.listarChatsDaConta(conta.id, { last_message_at_start: cursor });

      for (const chat of chats) {
        if (chatsProcessados >= MAX_CHATS_POR_EXECUCAO) {
          truncado = true;
          break contasLoop;
        }

        try {
          const resultado = await sincronizarChat(supabase, clint, chat, conta.type, cursor);
          chatsProcessados++;
          mensagensGravadas += resultado.mensagensGravadas;
        } catch (err) {
          erros.push(`chat ${chat.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  } catch (err) {
    return new Response(`falha na sincronização: ${err instanceof Error ? err.message : String(err)}`, {
      status: 502,
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      chats_processados: chatsProcessados,
      mensagens_gravadas: mensagensGravadas,
      truncado,
      erros,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});

async function sincronizarChat(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  clint: ReturnType<typeof createClintClient>,
  chat: ClintChat,
  tipoCanal: string,
  cursor: string,
): Promise<{ mensagensGravadas: number }> {
  const corretorId = await upsertCorretor(supabase, chat.user_id);
  const leadId = await upsertLead(supabase, chat.contact_id);
  if (!corretorId || !leadId) return { mensagensGravadas: 0 };

  const { data: conversa, error: conversaError } = await supabase
    .from("conversas")
    .upsert(
      {
        crm_conversa_id: chat.id,
        lead_id: leadId,
        corretor_id: corretorId,
        canal: tipoCanal.toLowerCase(),
        iniciada_em: chat.created_at,
        finalizada_em: chat.closed_at,
      },
      { onConflict: "crm_conversa_id" },
    )
    .select("id")
    .single();

  if (conversaError || !conversa) {
    throw new Error(`upsert conversa falhou: ${conversaError?.message}`);
  }

  const mensagens = await clint.listarMensagensDoChat(chat.id, { updated_at_start: cursor });
  let mensagensGravadas = 0;

  for (const msg of mensagens) {
    const remetente = mapearRemetente(msg.type);
    if (!remetente) continue; // EVENT/NOTE não são mensagens de conversa

    const { error } = await supabase.from("mensagens").upsert(
      {
        crm_mensagem_id: msg.id,
        conversa_id: conversa.id,
        remetente,
        texto: msg.content,
        enviada_em: msg.created_at,
      },
      { onConflict: "crm_mensagem_id" },
    );

    if (!error) mensagensGravadas++;
  }

  if (mensagensGravadas > 0) {
    await atualizarHandoffIA(supabase, conversa.id);
    await atualizarStatusAnalise(supabase, conversa.id);
  }

  return { mensagensGravadas };
}

// Detecta a mensagem-resumo que a IA de qualificação manda antes de passar o
// lead pro corretor humano (algo como "Aqui está um resumo das informações
// que você me passou... um dos nossos corretores especialistas vai assumir o
// atendimento..."). Heurística por texto — a IA não usa uma conta separada
// no Clint, então não dá pra distinguir só pelo remetente/user_id.
function pareceResumoQualificacaoIA(texto: string): boolean {
  const t = texto.toLowerCase();

  const sinalHandoff =
    (t.includes("corretor") && (t.includes("assumir") || t.includes("atendimento"))) ||
    t.includes("simulação oficial");

  const rotulosDeQualificacao = ["nome:", "cidade", "idade:", "estado civil", "renda", "cpf"];
  const rotulosEncontrados = rotulosDeQualificacao.filter((r) => t.includes(r)).length;

  return sinalHandoff || rotulosEncontrados >= 3;
}

// Marca `conversas.humano_assumiu_em` na primeira vez que encontra o resumo
// da IA — a partir desse timestamp que a conversa passa a contar como
// atendimento humano (pra elegibilidade e pra análise). Uma vez marcado,
// nunca reavalia de novo (o handoff não muda depois de acontecer).
async function atualizarHandoffIA(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  conversaId: string,
): Promise<void> {
  const { data: conversa } = await supabase
    .from("conversas")
    .select("humano_assumiu_em")
    .eq("id", conversaId)
    .single();

  if (conversa?.humano_assumiu_em) return;

  const { data: mensagens } = await supabase
    .from("mensagens")
    .select("remetente, texto, enviada_em")
    .eq("conversa_id", conversaId)
    .order("enviada_em", { ascending: true });

  const resumo = (mensagens ?? []).find(
    (m: { remetente: string; texto: string }) => m.remetente === "corretor" && pareceResumoQualificacaoIA(m.texto),
  );

  if (resumo) {
    await supabase.from("conversas").update({ humano_assumiu_em: resumo.enviada_em }).eq("id", conversaId);
  }
}

// Só entra na fila de análise quando a conversa atinge o mínimo de interação
// (regra definida em `elegivel_para_analise`, hoje: 3+ mensagens, 2+ do lead).
// Nunca sobrescreve uma análise que já está processando/concluída/falhou.
async function atualizarStatusAnalise(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  conversaId: string,
): Promise<void> {
  const { data: existente } = await supabase
    .from("analises")
    .select("status")
    .eq("conversa_id", conversaId)
    .maybeSingle();

  if (existente && !["pendente", "nao_elegivel"].includes(existente.status)) return;

  const { data: elegivel } = await supabase.rpc("elegivel_para_analise", { p_conversa_id: conversaId });

  await supabase
    .from("analises")
    .upsert({ conversa_id: conversaId, status: elegivel ? "pendente" : "nao_elegivel" }, { onConflict: "conversa_id" });
}

function mapearRemetente(tipo: ClintMessage["type"]): "corretor" | "lead" | null {
  if (tipo === "USER") return "corretor";
  if (tipo === "CUSTOMER") return "lead";
  return null;
}

async function upsertCorretor(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string | null,
): Promise<string | null> {
  if (!userId) return null;

  await supabase
    .from("corretores")
    .upsert({ crm_id: userId, nome_crm: `Corretor ${userId.slice(0, 8)}` }, { onConflict: "crm_id", ignoreDuplicates: true });

  const { data } = await supabase.from("corretores").select("id").eq("crm_id", userId).single();
  return data?.id ?? null;
}

async function upsertLead(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  contactId: string | null,
): Promise<string | null> {
  if (!contactId) return null;

  await supabase
    .from("leads")
    .upsert({ crm_id: contactId }, { onConflict: "crm_id", ignoreDuplicates: true });

  const { data } = await supabase.from("leads").select("id").eq("crm_id", contactId).single();
  return data?.id ?? null;
}
