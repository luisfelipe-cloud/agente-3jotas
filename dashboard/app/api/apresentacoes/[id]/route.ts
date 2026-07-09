import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET — serve o HTML puro (Content-Type: text/html), pra abrir direto no
// navegador numa aba nova ou salvar como arquivo .html standalone.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase.from("apresentacoes").select("html").eq("id", id).single();

  if (error || !data) {
    return new Response("Apresentação não encontrada", { status: 404 });
  }

  return new Response(data.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { error } = await supabase.from("apresentacoes").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
