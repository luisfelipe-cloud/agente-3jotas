import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getDashboardSession } from "@/lib/session";
import type { CampanhaReativacaoResumo, LeadReativacaoHistorico } from "@/lib/types";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PeriodoCorretoresFiltro } from "@/components/PeriodoCorretoresFiltro";
import { ReativacaoCorretorPainel } from "@/components/ReativacaoCorretorPainel";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function BadgeSimNao({ valor }: { valor: boolean | null }) {
  if (valor === null) return <Badge variant="neutral">—</Badge>;
  return valor ? <Badge variant="success">Sim</Badge> : <Badge variant="error">Não</Badge>;
}

export default async function HistoricoReativacaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ corretorId: string }>;
  searchParams: Promise<{ inicio?: string; fim?: string }>;
}) {
  const { corretorId } = await params;

  const session = await getDashboardSession();
  if (session?.role === "corretor" && session.corretorId !== corretorId) {
    notFound();
  }

  const sp = await searchParams;
  const inicio = sp.inicio ?? hojeISO();
  const fim = sp.fim ?? hojeISO();

  const supabase = createServiceClient();

  const { data: corretor } = await supabase.from("corretores").select("nome_crm").eq("id", corretorId).maybeSingle();
  if (!corretor) notFound();

  const { data: campanhasRaw, error: campanhasError } = await supabase
    .from("campanhas_reativacao")
    .select("id, data, criado_em, campanha_reativacao_leads(id, atendeu)")
    .eq("corretor_id", corretorId)
    .order("data", { ascending: false });

  if (campanhasError) throw new Error(`Erro ao carregar campanhas: ${campanhasError.message}`);

  const campanhas: CampanhaReativacaoResumo[] = (campanhasRaw ?? []).map((c) => {
    const leads = (c.campanha_reativacao_leads ?? []) as { id: string; atendeu: boolean | null }[];
    return {
      id: c.id,
      corretorId,
      corretorNome: corretor.nome_crm,
      data: c.data,
      totalLeads: leads.length,
      totalRespondidos: leads.filter((l) => l.atendeu !== null).length,
      criadoEm: c.criado_em,
    };
  });

  const { data, error } = await supabase
    .from("campanha_reativacao_leads")
    .select(
      "id, nome, telefone, status_importado, etapa_funil_importado, atendeu_11h, atendeu_16h, atendeu_18h, atendeu, deseja_continuar, campanhas_reativacao!inner(data, corretor_id)",
    )
    .eq("campanhas_reativacao.corretor_id", corretorId)
    .gte("campanhas_reativacao.data", inicio)
    .lte("campanhas_reativacao.data", fim)
    .order("data", { referencedTable: "campanhas_reativacao", ascending: false });

  if (error) throw new Error(`Erro ao carregar histórico: ${error.message}`);

  const leads: LeadReativacaoHistorico[] = (data ?? []).map((l) => {
    const campanhaRel = l.campanhas_reativacao as unknown as { data: string } | { data: string }[];
    const campanha = Array.isArray(campanhaRel) ? campanhaRel[0] : campanhaRel;
    return {
      id: l.id,
      nome: l.nome,
      telefone: l.telefone,
      statusImportado: l.status_importado,
      etapaFunilImportado: l.etapa_funil_importado,
      atendeu11h: l.atendeu_11h,
      atendeu16h: l.atendeu_16h,
      atendeu18h: l.atendeu_18h,
      atendeu: l.atendeu,
      desejaContinuar: l.deseja_continuar,
      data: campanha.data,
    };
  });

  const totalLeads = leads.length;
  const atendeuSim = leads.filter((l) => l.atendeu === true).length;
  const atendeuNao = leads.filter((l) => l.atendeu === false).length;
  const semResposta = leads.filter((l) => l.atendeu === null).length;
  const desejaContinuarSim = leads.filter((l) => l.desejaContinuar === true).length;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <Link href="/reativacao-base" className="text-sm font-medium text-navy-600 hover:underline">
          ← Reativação
        </Link>
        <h1 className="text-2xl font-extrabold text-navy-900 mt-1">{corretor.nome_crm}</h1>
        <p className="text-sm text-text-secondary mt-1">Histórico de ligações de reativação no período selecionado</p>
      </div>

      <ReativacaoCorretorPainel
        corretorId={corretorId}
        campanhasIniciais={campanhas}
        filtro={<PeriodoCorretoresFiltro />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Leads na lista" value={totalLeads} />
        <StatCard label="Atendeu" value={atendeuSim} hint={`${atendeuNao} não atenderam`} />
        <StatCard label="Deseja continuar" value={desejaContinuarSim} />
        <StatCard label="Sem resposta ainda" value={semResposta} />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-navy-900">Leads</h2>
        {leads.length === 0 ? (
          <p className="text-sm text-text-secondary">Nenhum lead nesse período.</p>
        ) : (
          leads.map((lead) => (
            <Card key={lead.id} variant="elevated" className="!rounded-md">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-text-primary truncate">
                    {lead.nome ?? "Sem nome"}
                    <span className="font-normal text-text-secondary"> - {lead.telefone}</span>
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {new Date(`${lead.data}T00:00:00`).toLocaleDateString("pt-BR")}
                    {(lead.atendeu11h || lead.atendeu16h || lead.atendeu18h) &&
                      ` · ligou às ${[lead.atendeu11h && "11h", lead.atendeu16h && "16h", lead.atendeu18h && "18h"].filter(Boolean).join(", ")}`}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-text-secondary">Atendeu?</span>
                    <BadgeSimNao valor={lead.atendeu} />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-text-secondary">Continuar?</span>
                    <BadgeSimNao valor={lead.desejaContinuar} />
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
