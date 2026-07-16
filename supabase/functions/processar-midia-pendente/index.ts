// Descreve (via Gemini) as mensagens de áudio/imagem/documento que
// sync-clint gravou com um texto-placeholder e `midia_descrita = false`.
//
// Por que isso é uma function separada: sync-clint fazia essa chamada
// Gemini de forma síncrona, por mensagem, dentro do próprio loop de
// sincronização — cada uma somava ao tempo de execução até estourar o
// WORKER_RESOURCE_LIMIT da Edge Function (acontecia com frequência já só com
// transcrição de áudio). Separando, sync-clint volta a ser rápido (só grava
// o placeholder) e esta function processa em lotes pequenos, com seu próprio
// cron mais frequente, sem competir pelo orçamento de tempo da ingestão.
//
// Idempotente: só pega linhas com `midia_descrita = false` e marca `true` ao
// final de cada uma (sucesso ou falha) — uma execução que truncar no meio
// simplesmente deixa o resto pra próxima chamada do cron, sem duplicar
// trabalho.
//
// Disparo sugerido: pg_cron a cada 5 minutos, mesmo CRON_SECRET dos demais crons.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas");
  }

  return createClient(url, key);
}

interface MensagemPendente {
  id: string;
  conversa_id: string;
  midia_content_type: string;
  midia_content_url: string;
  midia_mime_type: string;
  midia_nome: string | null;
}

// Teto por execução — mantém cada chamada rápida e barata de sobra pra nunca
// disputar o WORKER_RESOURCE_LIMIT; com cron de 5 em 5 minutos, um volume
// alto de mídia pendente é absorvido em poucos ciclos, não numa invocação só.
const LOTE_MAXIMO = 15;

const INSTRUCAO_AUDIO =
  'Transcreva literalmente o que é dito neste áudio, em português. Só a transcrição, nada mais. Se não der pra entender, responda apenas "[áudio inaudível]".';
const INSTRUCAO_IMAGEM =
  "Descreva em 1-2 frases o que aparece nesta imagem, em português. Seja objetivo e literal — não invente detalhes que não estão visíveis. Se for print de tela, comprovante ou documento fotografado, transcreva as informações principais (valores, nomes, datas) em vez de só descrever visualmente.";
const INSTRUCAO_DOCUMENTO =
  "Resuma em 1-2 frases o conteúdo deste documento, em português. Cite valores, nomes e datas relevantes se houver — não invente informação que não está no documento.";

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const clintApiKey = Deno.env.get("CLINT_API_KEY");
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!clintApiKey || !geminiApiKey) {
    return new Response("CLINT_API_KEY / GEMINI_API_KEY não configuradas", { status: 500 });
  }

  const supabase = createServiceClient();

  const { data: pendentes, error: pendentesError } = await supabase
    .from("mensagens")
    .select("id, conversa_id, midia_content_type, midia_content_url, midia_mime_type, midia_nome")
    .eq("midia_descrita", false)
    .order("enviada_em", { ascending: true })
    .limit(LOTE_MAXIMO);

  if (pendentesError) {
    return new Response(`falha ao buscar pendentes: ${pendentesError.message}`, { status: 502 });
  }

  let processadas = 0;
  let sucesso = 0;
  const conversasParaReabrir = new Set<string>();
  const erros: string[] = [];

  for (const msg of (pendentes ?? []) as MensagemPendente[]) {
    try {
      const texto = await descreverEProduzirTexto(clintApiKey, geminiApiKey, msg);
      const { error } = await supabase
        .from("mensagens")
        .update({ texto, midia_descrita: true })
        .eq("id", msg.id);
      if (error) throw new Error(error.message);

      processadas++;
      if (!texto.includes("não foi possível")) sucesso++;
      conversasParaReabrir.add(msg.conversa_id);
    } catch (err) {
      erros.push(`mensagem ${msg.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // A análise pode já ter rodado sobre o placeholder antes da descrição
  // ficar pronta — reabre pra 'pendente' (mesma regra de
  // atualizarStatusAnalise do sync-clint) só as conversas que de fato
  // ganharam texto novo agora, senão a descrição nunca entra em análise
  // nenhuma. Não mexe se já está 'processando'.
  for (const conversaId of conversasParaReabrir) {
    try {
      const { data: existente } = await supabase
        .from("analises")
        .select("status")
        .eq("conversa_id", conversaId)
        .maybeSingle();
      if (existente?.status === "processando") continue;

      const { data: elegivel } = await supabase.rpc("elegivel_para_analise", { p_conversa_id: conversaId });
      await supabase
        .from("analises")
        .upsert({ conversa_id: conversaId, status: elegivel ? "pendente" : "nao_elegivel" }, { onConflict: "conversa_id" });
    } catch (err) {
      erros.push(`reabrir análise ${conversaId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, processadas, sucesso, conversas_reabertas: conversasParaReabrir.size, erros }),
    { headers: { "Content-Type": "application/json" } },
  );
});

async function descreverEProduzirTexto(clintApiKey: string, geminiApiKey: string, msg: MensagemPendente): Promise<string> {
  const instrucao =
    msg.midia_content_type === "AUDIO"
      ? INSTRUCAO_AUDIO
      : msg.midia_content_type === "IMAGE"
        ? INSTRUCAO_IMAGEM
        : INSTRUCAO_DOCUMENTO;

  const descricao = await descreverMidia(clintApiKey, geminiApiKey, msg.midia_content_url, msg.midia_mime_type, instrucao);

  if (msg.midia_content_type === "AUDIO") {
    return descricao ? `[Áudio transcrito] ${descricao}` : "[Áudio enviado — não foi possível transcrever]";
  }
  if (msg.midia_content_type === "IMAGE") {
    return descricao ? `[Imagem: ${descricao}]` : "[Imagem enviada — não foi possível descrever]";
  }
  // DOCUMENT
  const rotuloNome = msg.midia_nome ? ` "${msg.midia_nome}"` : "";
  return descricao ? `[Documento${rotuloNome}: ${descricao}]` : `[Documento${rotuloNome} enviado — não foi possível resumir]`;
}

// Baixa o arquivo (mesmo `api-token` usado nas outras chamadas ao Clint) e
// manda pro Gemini com a instrução dada. Falha (rede, Gemini fora, arquivo
// corrompido) retorna null — quem chama cai no placeholder de falha
// permanente (a mensagem já foi marcada `midia_descrita = true`, não tenta
// de novo depois).
async function descreverMidia(
  clintApiKey: string,
  geminiApiKey: string,
  contentUrl: string,
  mimeType: string,
  instrucao: string,
): Promise<string | null> {
  try {
    const arquivoResp = await fetch(contentUrl, { headers: { "api-token": clintApiKey } });
    if (!arquivoResp.ok) return null;

    const arquivoBase64 = encodeBase64(await arquivoResp.arrayBuffer());

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: instrucao }, { inline_data: { mime_type: mimeType, data: arquivoBase64 } }],
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
