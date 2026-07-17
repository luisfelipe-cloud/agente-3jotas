import { NextResponse } from "next/server";

// Aciona a Edge Function analisar-conversa-unica sob demanda (botão
// "Analisar conversa"). Serve tanto pra não esperar o lote noturno quanto de
// fallback manual se o pipeline em lote (analysis-batch-submit/poll) não
// tiver rodado por algum motivo.
//
// O CRON_SECRET fica só no servidor (nunca em NEXT_PUBLIC_*) — o browser
// chama esta route, que repassa a chamada autenticada.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!supabaseUrl || !cronSecret) {
    return NextResponse.json(
      { ok: false, erro: "NEXT_PUBLIC_SUPABASE_URL / CRON_SECRET não configuradas no servidor" },
      { status: 500 },
    );
  }

  const resp = await fetch(`${supabaseUrl}/functions/v1/analisar-conversa-unica`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cronSecret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ conversaId: id }),
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
