import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { mapCampanhaReativacaoLead } from "@/lib/mappers";

// Rotas públicas (sem login) — ver exclusão em dashboard/proxy.ts. O
// corretor abre o link /reativacao/{campanhaId} e preenche a lista sem
// precisar de conta no dashboard.

export async function GET(_req: Request, { params }: { params: Promise<{ campanhaId: string }> }) {
  const { campanhaId } = await params;
  const supabase = createServiceClient();

  const { data: campanha, error: campanhaError } = await supabase
    .from("campanhas_reativacao")
    .select("id, data, corretores(nome_crm)")
    .eq("id", campanhaId)
    .maybeSingle();

  if (campanhaError) return NextResponse.json({ ok: false, erro: campanhaError.message }, { status: 500 });
  if (!campanha) return NextResponse.json({ ok: false, erro: "Campanha não encontrada" }, { status: 404 });

  const { data: leads, error: leadsError } = await supabase
    .from("campanha_reativacao_leads")
    .select("id, nome, telefone, status_importado, etapa_funil_importado, atendeu_11h, atendeu_16h, atendeu_18h, atendeu, deseja_continuar")
    .eq("campanha_id", campanhaId)
    .order("nome", { ascending: true });

  if (leadsError) return NextResponse.json({ ok: false, erro: leadsError.message }, { status: 500 });

  const corretorRel = campanha.corretores as unknown as { nome_crm: string } | { nome_crm: string }[] | null;
  const corretor = Array.isArray(corretorRel) ? corretorRel[0] : corretorRel;

  return NextResponse.json({
    ok: true,
    campanha: {
      id: campanha.id,
      corretorNome: corretor?.nome_crm ?? "Corretor",
      data: campanha.data,
      leads: (leads ?? []).map(mapCampanhaReativacaoLead),
    },
  });
}

