import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Botão "Desconsiderar análise" — exclui a análise de vez (não é só um
// status "desconsiderada"): a nota some do banco, corretor_ranking e as
// médias por critério recalculam sozinhos na próxima leitura (são agregados
// ao vivo via SQL, não um valor guardado em algum lugar). Se a conversa
// receber mensagem nova depois, o sync-clint recria a análise normalmente
// (fluxo de sempre) e ela volta a ser processada do zero.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { error } = await supabase.from("analises").delete().eq("conversa_id", id);

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
