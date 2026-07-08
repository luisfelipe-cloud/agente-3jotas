import { NextResponse } from "next/server";

export const maxDuration = 300;

// Botão de teste "Buscar e analisar conversas" — chama, em sequência, as
// TRÊS Edge Functions que em produção rodam sozinhas via cron:
//   sync-clint (busca conversas novas) → analyze-conversation-sweep (1º passe
//   nas pendentes) → analyze-conversation-review (2º passe nas concluídas).
// É o mesmo caminho de código do cron, só disparado manualmente pra dar pra
// ver o resultado na hora em vez de esperar os crons rodarem sozinhos.
async function chamarFuncao(supabaseUrl: string, cronSecret: string, nome: string) {
  const resp = await fetch(`${supabaseUrl}/functions/v1/${nome}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cronSecret}`, "Content-Type": "application/json" },
    body: "{}",
  });

  const texto = await resp.text();
  let corpo: unknown;
  try {
    corpo = JSON.parse(texto);
  } catch {
    corpo = { bruto: texto };
  }

  return { ok: resp.ok, status: resp.status, corpo };
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
