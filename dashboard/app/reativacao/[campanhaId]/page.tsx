import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { mapCampanhaReativacaoLead } from "@/lib/mappers";
import type { CampanhaReativacaoDetalhe } from "@/lib/types";
import { ReativacaoForm } from "@/components/ReativacaoForm";

// Página pública (sem login) — ver exclusão em dashboard/proxy.ts. Fora do
// grupo (app) de propósito, pra não herdar a sidebar nem a exigência de
// sessão (mesmo esquema de /login, ver app/(app)/layout.tsx).
export default async function ReativacaoPage({ params }: { params: Promise<{ campanhaId: string }> }) {
  const { campanhaId } = await params;
  const supabase = createServiceClient();

  const { data: campanha } = await supabase
    .from("campanhas_reativacao")
    .select("id, data, corretores(nome_crm)")
    .eq("id", campanhaId)
    .maybeSingle();

  if (!campanha) notFound();

  const { data: leads } = await supabase
    .from("campanha_reativacao_leads")
    .select("id, nome, telefone, status_importado, etapa_funil_importado, atendeu_11h, atendeu_16h, atendeu_18h, atendeu, deseja_continuar")
    .eq("campanha_id", campanhaId)
    .order("nome", { ascending: true });

  const corretorRel = campanha.corretores as unknown as { nome_crm: string } | { nome_crm: string }[] | null;
  const corretor = Array.isArray(corretorRel) ? corretorRel[0] : corretorRel;

  const detalhe: CampanhaReativacaoDetalhe = {
    id: campanha.id,
    corretorNome: corretor?.nome_crm ?? "Corretor",
    data: campanha.data,
    leads: (leads ?? []).map(mapCampanhaReativacaoLead),
  };

  return (
    <div className="min-h-full w-full max-w-[100vw] overflow-x-hidden bg-gray-50 px-3 py-5 sm:px-4 sm:py-8">
      <div className="mx-auto w-full max-w-3xl space-y-5 sm:space-y-6">
        <div className="px-1">
          <h1 className="text-lg sm:text-xl font-extrabold text-navy-900 break-words">
            Bateria de ligação — {detalhe.corretorNome}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {new Date(`${detalhe.data}T00:00:00`).toLocaleDateString("pt-BR")} · {detalhe.leads.length} lead
            {detalhe.leads.length === 1 ? "" : "s"}
          </p>
        </div>

        <ReativacaoForm campanhaId={detalhe.id} leadsIniciais={detalhe.leads} />
      </div>
    </div>
  );
}
