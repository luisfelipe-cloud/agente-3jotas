import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { MensagemChat } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("mensagens")
    .select("id, remetente, texto, enviada_em")
    .eq("conversa_id", id)
    .order("enviada_em", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  const mensagens: MensagemChat[] = (data ?? []).map((m) => ({
    id: m.id,
    remetente: m.remetente,
    texto: m.texto,
    enviadaEm: m.enviada_em,
  }));

  return NextResponse.json({ ok: true, mensagens });
}
