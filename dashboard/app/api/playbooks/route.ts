import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// POST — cria um novo script de playbook. Se vier ativo=true, desativa
// primeiro qualquer outro script ativo da mesma etapa (índice único parcial
// `idx_playbooks_ativo_por_etapa` só permite um ativo por etapa).
export async function POST(req: Request) {
  const body = await req.json();

  if (typeof body.etapa !== "string" || typeof body.conteudo !== "string") {
    return NextResponse.json({ ok: false, erro: "etapa e conteudo são obrigatórios" }, { status: 400 });
  }

  const supabase = createServiceClient();

  if (body.ativo === true) {
    const { error: desativarError } = await supabase.from("playbooks").update({ ativo: false }).eq("etapa", body.etapa).eq("ativo", true);
    if (desativarError) {
      return NextResponse.json({ ok: false, erro: desativarError.message }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("playbooks")
    .insert({ etapa: body.etapa, conteudo: body.conteudo, ativo: body.ativo === true })
    .select("id, etapa, conteudo, ativo, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, playbook: data });
}
