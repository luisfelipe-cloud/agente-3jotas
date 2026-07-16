import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// POST — cria um novo script de playbook. Vários podem estar ativos ao
// mesmo tempo (inclusive da mesma etapa) — o critério "playbook" já avalia
// juntando todos os ativos como referência, não é mais 1 por etapa.
export async function POST(req: Request) {
  const body = await req.json();

  if (typeof body.etapa !== "string" || typeof body.conteudo !== "string") {
    return NextResponse.json({ ok: false, erro: "etapa e conteudo são obrigatórios" }, { status: 400 });
  }

  const supabase = createServiceClient();

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
