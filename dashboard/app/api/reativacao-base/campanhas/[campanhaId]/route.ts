import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Exclui uma bateria (campanha) e seus leads (cascade via FK) — usado pelo
// botão "Excluir" no painel do corretor em /reativacao-base/[corretorId].
export async function DELETE(_req: Request, { params }: { params: Promise<{ campanhaId: string }> }) {
  const { campanhaId } = await params;
  const supabase = createServiceClient();

  const { error } = await supabase.from("campanhas_reativacao").delete().eq("id", campanhaId);

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
