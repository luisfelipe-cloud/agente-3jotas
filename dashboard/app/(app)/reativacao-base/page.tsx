import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getDashboardSession } from "@/lib/session";
import { ReativacaoCorretoresLista, type CorretorReativacaoResumo } from "@/components/ReativacaoCorretoresLista";

export default async function ReativacaoBasePage() {
  const session = await getDashboardSession();
  if (session?.role === "corretor") {
    redirect(`/reativacao-base/${session.corretorId}`);
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("corretores")
    .select("id, nome_crm, ativo, campanhas_reativacao(campanha_reativacao_leads(id))")
    .order("nome_crm", { ascending: true });

  if (error) throw new Error(`Erro ao carregar corretores: ${error.message}`);

  const corretores: CorretorReativacaoResumo[] = (data ?? []).map((c) => {
    const campanhas = (c.campanhas_reativacao ?? []) as { campanha_reativacao_leads: { id: string }[] }[];
    const totalLeads = campanhas.reduce((soma, camp) => soma + (camp.campanha_reativacao_leads?.length ?? 0), 0);
    return { id: c.id, nomeCrm: c.nome_crm, ativo: c.ativo, totalLeads };
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">Reativação de base</h1>
        <p className="text-sm text-text-secondary mt-1">
          Selecione um corretor pra importar a lista de leads perdidos dele e acompanhar as ligações.
        </p>
      </div>

      <ReativacaoCorretoresLista corretores={corretores} />
    </div>
  );
}
