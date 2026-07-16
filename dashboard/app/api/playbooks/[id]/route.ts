import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// PATCH — atualiza etapa/conteudo/ativo de um script. Vários podem estar
// ativos ao mesmo tempo (inclusive da mesma etapa) — não desativa mais os
// demais ao ativar um.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const supabase = createServiceClient();

  const patch: Record<string, unknown> = {};
  if (typeof body.etapa === "string") patch.etapa = body.etapa;
  if (typeof body.conteudo === "string") patch.conteudo = body.conteudo;
  if (typeof body.ativo === "boolean") patch.ativo = body.ativo;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ ok: false, erro: "nada para atualizar" }, { status: 400 });
  }

  const { error } = await supabase.from("playbooks").update(patch).eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE — remove o script. Sem cascata: playbooks não têm FK apontando pra eles.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { error } = await supabase.from("playbooks").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
