import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Pública (sem login) — ver exclusão em dashboard/proxy.ts (o prefixo
// api/reativacao/ cobre esta subrota também). Salva em tempo real: cada
// toque num chip do formulário do corretor chama isso na hora, não existe
// botão "Salvar" — só os campos alterados são enviados no body.

interface PatchBody {
  atendeu11h?: boolean;
  atendeu16h?: boolean;
  atendeu18h?: boolean;
  atendeu?: boolean | null;
  desejaContinuar?: boolean | null;
}

const MAPA_CAMPOS: Record<keyof PatchBody, string> = {
  atendeu11h: "atendeu_11h",
  atendeu16h: "atendeu_16h",
  atendeu18h: "atendeu_18h",
  atendeu: "atendeu",
  desejaContinuar: "deseja_continuar",
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ campanhaId: string; leadId: string }> },
) {
  const { campanhaId, leadId } = await params;
  const body = (await req.json()) as PatchBody;

  const update: Record<string, boolean | null> = {};
  for (const chave of Object.keys(body) as (keyof PatchBody)[]) {
    const coluna = MAPA_CAMPOS[chave];
    if (coluna) update[coluna] = body[chave] ?? null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, erro: "nenhum campo reconhecido no body" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("campanha_reativacao_leads")
    .update(update)
    .eq("id", leadId)
    .eq("campanha_id", campanhaId);

  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
