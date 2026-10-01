import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { MensagemChat } from "@/lib/types";
import { getDashboardSession } from "@/lib/session";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDashboardSession();
  if (!session || session.role === "pendente") return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 403 });
  const { id } = await params;
  const supabase = createServiceClient();
  if (session.role === "corretor") {
    const { data: conversa, error: conversaError } = await supabase.from("conversas").select("corretor_id").eq("id", id).maybeSingle();
    if (conversaError || conversa?.corretor_id !== session.corretorId) return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 403 });
  }

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
