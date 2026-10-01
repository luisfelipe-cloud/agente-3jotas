import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getDashboardSession } from "@/lib/session";

export async function PATCH(req: Request, { params }: { params: Promise<{ criterio: string }> }) {
  if ((await getDashboardSession())?.role !== "admin") return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 403 });
  const { criterio } = await params;
  const body = await req.json();

  const patch: Record<string, unknown> = {};
  if (typeof body.descricao === "string" && body.descricao.trim()) patch.descricao = body.descricao.trim();
  if (typeof body.notaMaxima === "number") patch.nota_maxima = body.notaMaxima;
  if (typeof body.pesoPercentual === "number") patch.peso_percentual = body.pesoPercentual;
  if (typeof body.ativo === "boolean") patch.ativo = body.ativo;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ ok: false, erro: "nada para atualizar" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("parametros_analise").update(patch).eq("criterio", criterio);

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
