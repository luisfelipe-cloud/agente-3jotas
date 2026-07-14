import { NextResponse } from "next/server";

export const maxDuration = 300;

// Botão de teste "Buscar e analisar conversas" — chama, em sequência, as
// TRÊS Edge Functions que em produção rodam sozinhas via cron:
//   sync-clint (busca conversas novas) → analyze-conversation-sweep (1º passe
//   nas pendentes) → analyze-conversation-review (2º passe nas concluídas).
// É o mesmo caminho de código do cron, só disparado manualmente pra dar pra
// ver o resultado na hora em vez de esperar os crons rodarem sozinhos.
// Timeout por function bem abaixo do limite da plataforma (maxDuration=300
// abaixo é só o teto declarado — planos sem Fluid Compute/Pro cortam a
// função bem antes disso e devolvem uma página de erro não-JSON). Com esse
// timeout, uma function lenta (ex: review processando várias conversas)
// falha de forma isolada e legível, em vez de arrastar as outras duas pro
// mesmo estouro.
const TIMEOUT_POR_FUNCAO_MS = 60_000;

async function chamarFuncao(supabaseUrl: string, cronSecret: string, nome: string) {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/${nome}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cronSecret}`, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(TIMEOUT_POR_FUNCAO_MS),
    });

    const texto = await resp.text();
    let corpo: unknown;
    try {
      corpo = JSON.parse(texto);
    } catch {
      corpo = { bruto: texto };
    }

    return { ok: resp.ok, status: resp.status, corpo };
  } catch (err) {
    const timeout = err instanceof Error && err.name === "TimeoutError";
    return {
      ok: false,
      status: 0,
      corpo: {
        erro: timeout
          ? `${nome} não respondeu em ${TIMEOUT_POR_FUNCAO_MS / 1000}s — ainda deve estar rodando em segundo plano no Supabase, só não deu tempo de esperar aqui.`
          : err instanceof Error
            ? err.message
            : String(err),
      },
    };
  }
}

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!supabaseUrl || !cronSecret) {
    return NextResponse.json(
      { ok: false, erro: "NEXT_PUBLIC_SUPABASE_URL / CRON_SECRET não configuradas no servidor" },
      { status: 500 },
    );
  }

  const sync = await chamarFuncao(supabaseUrl, cronSecret, "sync-clint");
  const analise = await chamarFuncao(supabaseUrl, cronSecret, "analyze-conversation-sweep");
  const revisao = await chamarFuncao(supabaseUrl, cronSecret, "analyze-conversation-review");

  return NextResponse.json({
    ok: sync.ok && analise.ok && revisao.ok,
    sync: sync.corpo,
    analise: analise.corpo,
    revisao: revisao.corpo,
  });
}
