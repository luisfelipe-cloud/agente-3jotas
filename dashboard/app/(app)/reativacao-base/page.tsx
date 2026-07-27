import { createServiceClient } from "@/lib/supabase/server";
import type { CampanhaReativacaoResumo } from "@/lib/types";
import { ReativacaoBaseManager } from "@/components/ReativacaoBaseManager";

export default async function ReativacaoBasePage() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("campanhas_reativacao")
    .select("id, corretor_id, data, criado_em, corretores(nome_crm), campanha_reativacao_leads(id, atendeu)")
    .order("data", { ascending: false });

  if (error) throw new Error(`Erro ao carregar campanhas: ${error.message}`);

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

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">Reativação de base</h1>
        <p className="text-sm text-text-secondary mt-1">
          Suba o CSV de leads perdidos (exportado do Clint) — o sistema separa por corretor e gera um link de
          preenchimento pra cada um.
        </p>
      </div>

      <ReativacaoBaseManager campanhasIniciais={campanhas} />
    </div>
  );
}
