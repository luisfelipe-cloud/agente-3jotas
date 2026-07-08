import { NextResponse } from "next/server";

// Aciona a Edge Function sync-clint sob demanda (botão "Sincronizar
// conversas"). O disparo principal continua sendo o pg_cron a cada 10min —
// isso aqui é só para forçar uma sincronização fora do horário do cron.
//
// O CRON_SECRET fica só no servidor (nunca em NEXT_PUBLIC_*) para não vazar
// pro browser — o browser chama esta route, que repassa a chamada autenticada.
export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!supabaseUrl || !cronSecret) {
    return NextResponse.json(
      { ok: false, erro: "NEXT_PUBLIC_SUPABASE_URL / CRON_SECRET não configuradas no servidor" },
      { status: 500 },
    );
  }

  const resp = await fetch(`${supabaseUrl}/functions/v1/sync-clint`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cronSecret}` },
  });

  const texto = await resp.text();

  if (!resp.ok) {
    return NextResponse.json({ ok: false, erro: texto }, { status: resp.status });
  }

  try {
    return NextResponse.json(JSON.parse(texto));
  } catch {
    return NextResponse.json({ ok: true, bruto: texto });
  }
}
