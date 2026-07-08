import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const body = await req.json();
  const nomeCrm = typeof body.nome_crm === "string" ? body.nome_crm.trim() : "";

  if (!nomeCrm) {
    return NextResponse.json({ ok: false, erro: "nome_crm é obrigatório" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("corretores")
    .insert({ nome_crm: nomeCrm, ativo: body.ativo ?? true })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
