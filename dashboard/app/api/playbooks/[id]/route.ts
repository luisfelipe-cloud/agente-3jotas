import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// PATCH — atualiza etapa/conteudo/ativo de um script. Se ativo=true, desativa
// primeiro qualquer outro script ativo da mesma etapa antes de aplicar a
// mudança (índice único parcial só permite um ativo por etapa).
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

  if (patch.ativo === true) {
    const { data: atual, error: buscaError } = await supabase.from("playbooks").select("etapa").eq("id", id).single();
    if (buscaError || !atual) {
      return NextResponse.json({ ok: false, erro: buscaError?.message ?? "playbook não encontrado" }, { status: 404 });
    }

    const etapaAlvo = (patch.etapa as string | undefined) ?? atual.etapa;
    const { error: desativarError } = await supabase
      .from("playbooks")
      .update({ ativo: false })
      .eq("etapa", etapaAlvo)
      .eq("ativo", true)
      .neq("id", id);
    if (desativarError) {
      return NextResponse.json({ ok: false, erro: desativarError.message }, { status: 500 });
    }
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
