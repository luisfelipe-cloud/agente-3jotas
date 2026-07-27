import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { CampanhaReativacaoResumo } from "@/lib/types";

// Lista as campanhas já criadas, mais recentes primeiro — usado pela tela
// de gestão (/reativacao-base) pra mostrar o progresso e gerar o link
// público de cada uma.
export async function GET() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("campanhas_reativacao")
    .select("id, corretor_id, data, criado_em, corretores(nome_crm), campanha_reativacao_leads(id, atendeu)")
    .order("data", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  const campanhas: CampanhaReativacaoResumo[] = (data ?? []).map((c) => {
    const corretorRel = c.corretores as unknown as { nome_crm: string } | { nome_crm: string }[] | null;
    const corretor = Array.isArray(corretorRel) ? corretorRel[0] : corretorRel;
    const leads = (c.campanha_reativacao_leads ?? []) as { id: string; atendeu: boolean | null }[];

    return {
      id: c.id,
      corretorId: c.corretor_id,
      corretorNome: corretor?.nome_crm ?? "Corretor",
      data: c.data,
      totalLeads: leads.length,
      totalRespondidos: leads.filter((l) => l.atendeu !== null).length,
      criadoEm: c.criado_em,
    };
  });

  return NextResponse.json({ ok: true, campanhas });
}
