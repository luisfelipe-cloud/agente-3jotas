import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const patch: Record<string, unknown> = {};
  if (typeof body.nome_crm === "string" && body.nome_crm.trim()) patch.nome_crm = body.nome_crm.trim();
  if (typeof body.ativo === "boolean") patch.ativo = body.ativo;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ ok: false, erro: "nada para atualizar" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("corretores").update(patch).eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Apagar um corretor apaga em cascata conversas/mensagens/análises dele
// (FK on delete cascade) — irreversível quando já existe histórico real.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { error } = await supabase.from("corretores").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
