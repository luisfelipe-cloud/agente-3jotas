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
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

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
  content: string | null;
  type: "USER" | "CUSTOMER" | "EVENT" | "NOTE";
  content_type: string;
  content_url: string | null;
  // Vem `null` quando quem escreveu foi a IA de qualificação (ela não usa
  // uma conta própria no Clint) e com o crm_id do corretor quando foi um
  // humano — é o sinal estruturado que usamos pra achar o handoff, em vez
  // de adivinhar pelo texto da mensagem.
  user_id: string | null;
}

interface PaginatedResponse<T> {
  data: T[];
  has_next: boolean;
}

// /v2/deals é o único endpoint com nome/telefone reais do lead e nome real
// do corretor (nas outras rotas só vem contact_id/user_id, sem nome). Não
// tem endpoint de busca por id único (contact/{id}, user/{id} — testado,
// 404), só filtro de listagem. E o formato de paginação é diferente do
// resto da API (totalCount/hasNext em vez de has_next), então usa fetch
// próprio em vez de `listarTudo`.
interface ClintDeal {
  id: string;
  user: { id: string; full_name: string } | null;
  contact: { id: string; name: string | null; phone: string | null } | null;
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

  async function buscarDeals(params: Record<string, string | undefined>): Promise<ClintDeal[]> {
    const url = new URL(`${baseUrl}/v2/deals`);
    url.searchParams.set("limit", "200");
    for (const [chave, valor] of Object.entries(params)) {
      if (valor) url.searchParams.set(chave, valor);
    }

    const resp = await fetch(url, { headers: { "api-token": apiKey! } });
    if (!resp.ok) throw new Error(`Clint API /v2/deals retornou ${resp.status}: ${await resp.text()}`);

    const body = await resp.json();
    return (body.data ?? []) as ClintDeal[];
  }

  return {
    listarContas: (params: Record<string, string | undefined> = {}) =>
      listarTudo<ClintChannelAccount>("/v2/channel-accounts", params),
    listarChatsDaConta: (channelAccountId: string, params: Record<string, string | undefined> = {}) =>
      listarTudo<ClintChat>(`/v2/chats/channel-account/${channelAccountId}`, params),
    listarMensagensDoChat: (chatId: string, params: Record<string, string | undefined> = {}) =>
      listarTudo<ClintMessage>(`/v2/messages/chat/${chatId}`, params),
    // Primeira página (200 mais recentes), sem filtro — na prática já cobre
    // os corretores ativos, porque eles aparecem como dono em vários
    // negócios recentes. Usado só pra montar o mapa de nomes, não precisa
    // de todas as 20mil+ linhas.
    buscarPrimeiraPaginaDeals: () => buscarDeals({}),
    buscarContatoPorId: async (contactId: string) => {
      const deals = await buscarDeals({ contact_id: contactId, limit: "1" });
      return deals[0]?.contact ?? null;
    },
  };
}

// Limite de segurança por execução — mesmo escopo sendo só "hoje", um dia
// de pico pode ter muitos chats; corta aqui para não estourar o limite de
// recursos da Edge Function (WORKER_RESOURCE_LIMIT). Se truncar, a próxima
// execução (cron ou botão) reprocessa o dia inteiro de novo — inofensivo,
// os upserts são idempotentes por crm_conversa_id/crm_mensagem_id.
// Baixado de 100 pra 20 depois que a transcrição de áudio (download +
// base64 + chamada Gemini por áudio, dentro do loop de mensagens) passou a
// estourar esse limite com muita frequência — cada chat com vários áudios
// pesa bem mais do que um chat só de texto.
const MAX_CHATS_POR_EXECUCAO = 20;

// Teto de quantos chats a função examina no total (incluindo os já
// sincronizados, que são baratos de pular) — segurança pra não rodar sobre
// um dia inteiro de chats antigos numa única invocação mesmo quando nenhum
// deles conta pro teto acima.
const MAX_CHATS_EXAMINADOS_POR_EXECUCAO = 300;

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

  // Nome real do corretor (best-effort) — se a chamada falhar ou o corretor
  // não aparecer na primeira página, cai no placeholder de sempre em
  // upsertCorretor. Buscado uma vez por execução, não por chat.
  const nomesCorretor = new Map<string, string>();
  try {
    const deals = await clint.buscarPrimeiraPaginaDeals();
    for (const d of deals) {
      if (d.user?.id && d.user.full_name) nomesCorretor.set(d.user.id, d.user.full_name);
    }
  } catch {
    // segue sem nomes reais — não é crítico pra sincronização em si
  }

  let chatsProcessados = 0;
  let chatsExaminados = 0;
  let mensagensGravadas = 0;
  let truncado = false;
  const erros: string[] = [];

  try {
    const contas = await clint.listarContas();

    contasLoop: for (const conta of contas) {
      if (conta.status !== "CONNECTED") continue;

      const chats = await clint.listarChatsDaConta(conta.id, { last_message_at_start: cursor });

      for (const chat of chats) {
        // Duas contagens separadas: `chatsProcessados` só sobe quando o chat
        // trouxe mensagem nova de verdade (é isso que estoura o orçamento —
        // transcrição de áudio, chamadas de handoff/elegibilidade). Chats já
        // sincronizados em execuções anteriores hoje são baratos de pular
        // (só a listagem na Clint), então não contam pra esse teto — senão
        // o sync nunca avançava pros chats seguintes quando truncava.
        // `chatsExaminados` é só uma trava de segurança pra não examinar um
        // dia inteiro de chats já sincronizados numa única invocação.
        if (chatsProcessados >= MAX_CHATS_POR_EXECUCAO || chatsExaminados >= MAX_CHATS_EXAMINADOS_POR_EXECUCAO) {
          truncado = true;
          break contasLoop;
        }
        chatsExaminados++;

        try {
          const resultado = await sincronizarChat(supabase, clint, chat, conta.type, cursor, nomesCorretor);
          if (resultado.mensagensGravadas > 0) chatsProcessados++;
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
      chats_examinados: chatsExaminados,
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
  nomesCorretor: Map<string, string>,
): Promise<{ mensagensGravadas: number }> {
  const corretorId = await upsertCorretor(supabase, chat.user_id, nomesCorretor);
  const leadId = await upsertLead(supabase, clint, chat.contact_id);
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

  // Sem isso, toda execução re-baixava e re-transcrevia áudios já gravados
  // em execuções anteriores no mesmo dia — caro (chamada Gemini por áudio) e
  // também o motivo do sync nunca avançar pros próximos chats quando
  // truncava: o "trabalho" reaparecia idêntico a cada chamada.
  const { data: existentes } = await supabase
    .from("mensagens")
    .select("crm_mensagem_id")
    .eq("conversa_id", conversa.id);
  const idsExistentes = new Set((existentes ?? []).map((m: { crm_mensagem_id: string }) => m.crm_mensagem_id));

  for (const msg of mensagens) {
    if (idsExistentes.has(msg.id)) continue;

    const remetente = mapearRemetente(msg.type);
    if (!remetente) continue; // EVENT/NOTE não são mensagens de conversa

    const { error } = await supabase.from("mensagens").upsert(
      {
        crm_mensagem_id: msg.id,
        conversa_id: conversa.id,
        remetente,
        texto: await textoMensagem(msg, remetente),
        enviada_em: msg.created_at,
        autor_crm_user_id: remetente === "corretor" ? msg.user_id : null,
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

// Fallback só para mensagens sincronizadas antes deste campo existir (o
// sync só cobre "hoje" — ver comentário no topo do arquivo — então
// conversas de dias anteriores nunca vão ganhar `autor_crm_user_id`
// retroativamente). Detecta a mensagem-resumo que a IA de qualificação
// manda antes de passar o lead pro corretor humano (algo como "Aqui está
// um resumo das informações que você me passou... um dos nossos
// corretores especialistas vai assumir o atendimento...").
function pareceResumoQualificacaoIA(texto: string): boolean {
  const t = texto.toLowerCase();

  const sinalHandoff =
    (t.includes("corretor") && (t.includes("assumir") || t.includes("atendimento"))) ||
    t.includes("simulação oficial");

  const rotulosDeQualificacao = ["nome:", "cidade", "idade:", "estado civil", "renda", "cpf"];
  const rotulosEncontrados = rotulosDeQualificacao.filter((r) => t.includes(r)).length;

  return sinalHandoff || rotulosEncontrados >= 3;
}

// `humano_assumiu_em` marca o fim da fase da IA — quem lê usa
// `enviada_em > humano_assumiu_em` pra pegar só o que veio depois (ver
// analyze-conversation-sync/review, analysis-batch-submit). Por isso o
// valor gravado é o timestamp da ÚLTIMA mensagem antes do corretor humano
// assumir, não da primeira mensagem dele — senão o corte estrito (`>`)
// excluiria por engano a primeira mensagem humana.
//
// Detecção primária: primeira mensagem de corretor com `autor_crm_user_id`
// preenchido (sinal estruturado do Clint — null = IA de qualificação,
// preenchido = humano de verdade). Se essa mensagem for a primeira da
// conversa inteira, não há fase de IA a excluir (o corretor já começou o
// atendimento) e `humano_assumiu_em` fica null. Cai pra heurística de texto
// só se nenhuma mensagem da conversa tiver `autor_crm_user_id` (dado
// sincronizado antes desse campo existir).
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
    .select("remetente, texto, enviada_em, autor_crm_user_id")
    .eq("conversa_id", conversaId)
    .order("enviada_em", { ascending: true });

  const lista = mensagens ?? [];

  const indiceHumana = lista.findIndex(
    (m: { remetente: string; autor_crm_user_id: string | null }) =>
      m.remetente === "corretor" && m.autor_crm_user_id,
  );

  let cutoff: string | null = null;
  if (indiceHumana > 0) {
    cutoff = lista[indiceHumana - 1].enviada_em;
  } else if (indiceHumana === -1) {
    const resumo = lista.find(
      (m: { remetente: string; texto: string }) => m.remetente === "corretor" && pareceResumoQualificacaoIA(m.texto),
    );
    cutoff = resumo?.enviada_em ?? null;
  }
  // indiceHumana === 0: corretor humano já respondeu desde a primeira
  // mensagem, não tem fase de IA pra excluir — cutoff fica null.

  if (!cutoff) return;

  const { error } = await supabase.from("conversas").update({ humano_assumiu_em: cutoff }).eq("id", conversaId);

  if (error) throw new Error(`marcar humano_assumiu_em falhou: ${error.message}`);
}

// Só entra na fila de análise quando a conversa atinge o mínimo de interação
// (regra definida em `elegivel_para_analise`, hoje: 3+ mensagens, 2+ do lead).
// Chamada só quando chegaram mensagens novas nesta sincronização (ver
// `sincronizarChat`) — por isso reabre pra 'pendente' mesmo se já estava
// 'concluida'/'falhou': uma conversa que continua depois de já analisada
// precisa ser relida por inteiro (contexto completo) pra IA considerar as
// mensagens novas, senão elas nunca entram em análise nenhuma. Só não mexe
// se já está 'processando' agora mesmo, pra não brigar com uma análise em
// andamento.
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

  if (existente?.status === "processando") return;

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

// Baixa o áudio (mesmo `api-token` usado nas outras chamadas ao Clint) e
// pede pro Gemini transcrever literalmente — feito uma vez na ingestão, não
// a cada análise, então o resto do pipeline (analyze-conversation-sync,
// review, dashboard) nem precisa saber que a mensagem começou como áudio.
// Falha (rede, Gemini fora, áudio corrompido) não derruba a sincronização —
// cai no placeholder "[Áudio enviado]" e a próxima sincronização não tenta
// de novo (a mensagem já foi gravada com o placeholder), mas isso é raro o
// bastante pra não valer a pena um retry dedicado agora.
async function transcreverAudio(contentUrl: string): Promise<string | null> {
  const clintApiKey = Deno.env.get("CLINT_API_KEY");
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!clintApiKey || !geminiApiKey) return null;

  try {
    const audioResp = await fetch(contentUrl, { headers: { "api-token": clintApiKey } });
    if (!audioResp.ok) return null;

    const audioBase64 = encodeBase64(await audioResp.arrayBuffer());

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: 'Transcreva literalmente o que é dito neste áudio, em português. Só a transcrição, nada mais. Se não der pra entender, responda apenas "[áudio inaudível]".',
                },
                { inline_data: { mime_type: "audio/ogg", data: audioBase64 } },
              ],
            },
          ],
        }),
      },
    );
    if (!resp.ok) return null;

    const data = await resp.json();
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return texto || null;
  } catch {
    return null;
  }
}

// `mensagens.texto` é NOT NULL, mas nem toda mensagem do Clint tem `content`
// preenchido (chamadas, mídia sem legenda, figurinhas, etc. vêm com
// `content: null`) — sem isso, o upsert falhava em silêncio (erro ignorado
// no loop de sincronização) e a mensagem simplesmente nunca era gravada.
// CALL_MISSED_VOICE em especial vira uma evidência real e estruturada pro
// critério "fluxo" (tentativa de contato por ligação), em vez de precisar
// adivinhar pelo tom da mensagem seguinte.
async function textoMensagem(msg: ClintMessage, remetente: "corretor" | "lead"): Promise<string> {
  if (msg.content) return msg.content;

  if (msg.content_type === "AUDIO" && msg.content_url) {
    const transcrito = await transcreverAudio(msg.content_url);
    if (transcrito) return `[Áudio transcrito] ${transcrito}`;
  }

  switch (msg.content_type) {
    case "CALL_MISSED_VOICE":
      return remetente === "lead"
        ? "[Ligação de voz do lead não atendida pelo corretor]"
        : "[Ligação de voz do corretor não atendida pelo lead]";
    case "IMAGE":
      return "[Imagem enviada, sem legenda]";
    case "AUDIO":
      return "[Áudio enviado — não foi possível transcrever]";
    case "VIDEO":
      return "[Vídeo enviado, sem legenda]";
    case "DOCUMENT":
      return "[Documento enviado]";
    case "STICKER":
      return "[Figurinha enviada]";
    case "LOCATION":
      return "[Localização compartilhada]";
    case "CONTACT":
    case "CONTACT_ARRAY":
      return "[Contato compartilhado]";
    case "REACTION":
      return "[Reação a uma mensagem]";
    default:
      return `[Conteúdo sem texto: ${msg.content_type}]`;
  }
}

// `ignoreDuplicates: true` faz o nome real só ser gravado na CRIAÇÃO do
// registro — se o corretor já existe (inclusive com nome editado manualmente
// no dashboard via CorretoresManager), o upsert é no-op e não sobrescreve.
async function upsertCorretor(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string | null,
  nomesCorretor: Map<string, string>,
): Promise<string | null> {
  if (!userId) return null;

  const nomeReal = nomesCorretor.get(userId);

  await supabase
    .from("corretores")
    .upsert(
      { crm_id: userId, nome_crm: nomeReal ?? `Corretor ${userId.slice(0, 8)}` },
      { onConflict: "crm_id", ignoreDuplicates: true },
    );

  const { data } = await supabase.from("corretores").select("id").eq("crm_id", userId).single();
  return data?.id ?? null;
}

// Só busca o contato na Clint (telefone/nome real) se o lead ainda não
// existe — poupa uma chamada extra por chat pra leads já conhecidos, que é a
// maioria depois do primeiro sync.
async function upsertLead(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  clint: ReturnType<typeof createClintClient>,
  contactId: string | null,
): Promise<string | null> {
  if (!contactId) return null;

  const { data: existente } = await supabase.from("leads").select("id").eq("crm_id", contactId).maybeSingle();
  if (existente) return existente.id;

  let contato: { name: string | null; phone: string | null } | null = null;
  try {
    contato = await clint.buscarContatoPorId(contactId);
  } catch {
    // enriquecimento é best-effort — segue só com o crm_id se falhar
  }

  await supabase.from("leads").upsert(
    { crm_id: contactId, telefone: contato?.phone ?? null, nome_crm: contato?.name || null },
    { onConflict: "crm_id", ignoreDuplicates: true },
  );

  const { data } = await supabase.from("leads").select("id").eq("crm_id", contactId).single();
  return data?.id ?? null;
}
