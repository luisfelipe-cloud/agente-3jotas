import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { mapApresentacaoResumo, mapCorretorRanking, mapConversaAnalisada } from "@/lib/mappers";
import { CorretorAnalises } from "@/components/CorretorAnalises";
import { PeriodoCorretoresFiltro } from "@/components/PeriodoCorretoresFiltro";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function CorretorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ inicio?: string; fim?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const inicio = sp.inicio ?? hojeISO();
  const fim = sp.fim ?? hojeISO();

  const dataInicio = new Date(`${inicio}T00:00:00`);
  const dataFim = new Date(`${fim}T23:59:59.999`);

  const supabase = createServiceClient();

  const quinzeDiasAtras = new Date();
  quinzeDiasAtras.setDate(quinzeDiasAtras.getDate() - 14);
  quinzeDiasAtras.setHours(0, 0, 0, 0);

  const { data: rankingRows, error: rankingError } = await supabase.rpc("corretor_ranking", {
    data_inicio: quinzeDiasAtras.toISOString(),
    data_fim: new Date().toISOString(),
  });

  if (rankingError) throw new Error(`Erro ao carregar corretor: ${rankingError.message}`);

  const rankingRow = (rankingRows ?? []).find((r: { corretor_id: string }) => r.corretor_id === id);
  if (!rankingRow) notFound();
  const ranking = mapCorretorRanking(rankingRow);

  const { data: insight } = await supabase
    .from("corretor_insights")
    .select("texto, baseado_em_conversas, gerado_em")
    .eq("corretor_id", id)
    .maybeSingle();

  const { data: apresentacoesRows } = await supabase
    .from("apresentacoes")
    .select("id, titulo, data_inicio, data_fim, criado_em")
    .eq("corretor_id", id)
    .order("criado_em", { ascending: false });

  const apresentacoes = (apresentacoesRows ?? []).map(mapApresentacaoResumo);

  const { data: conversasRows } = await supabase
    .from("conversas")
    .select("id, iniciada_em, etapa_playbook, substituida_por_id, leads(nome_crm, telefone)")
    .eq("corretor_id", id)
    .order("iniciada_em", { ascending: false });

  const conversaIds = (conversasRows ?? []).map((c) => c.id);

  const [{ data: analisesRows }, { data: elegibilidadeRows }, { data: atividadeNoPeriodoRows }] = conversaIds.length
    ? await Promise.all([
        supabase.from("analises").select("*").in("conversa_id", conversaIds),
        supabase.from("conversa_elegibilidade").select("*").in("conversa_id", conversaIds),
        // Só precisamos saber QUAIS conversas tiveram mensagem no período, não
        // quantas — mas o default de 1000 linhas do PostgREST (ver
        // dashboard-data.ts) ainda pode truncar num período longo com muita
        // atividade; limit alto aqui evita esse mesmo bug de novo.
        supabase
          .from("mensagens")
          .select("conversa_id")
          .in("conversa_id", conversaIds)
          .gte("enviada_em", dataInicio.toISOString())
          .lte("enviada_em", dataFim.toISOString())
          .limit(20000),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const analisesPorConversa = new Map((analisesRows ?? []).map((a) => [a.conversa_id, a]));
  const elegibilidadePorConversa = new Map((elegibilidadeRows ?? []).map((e) => [e.conversa_id, e]));
  const conversasComAtividadeNoPeriodo = new Set((atividadeNoPeriodoRows ?? []).map((m) => m.conversa_id));

  const conversas = (conversasRows ?? [])
    .filter((c) => {
      // Mesmo critério de data usado no ranking (corretor_ranking, 0029):
      // teve pelo menos 1 mensagem no período — não a data de CRIAÇÃO da
      // conversa (iniciada_em). Depois da consolidação por lead (0021), a
      // conversa canônica de um lead pode ter sido criada semanas atrás e
      // seguir recebendo toda a atividade nova por meses; filtrar por
      // iniciada_em excluía quase toda conversa realmente ativa no período.
      return conversasComAtividadeNoPeriodo.has(c.id);
    })
    .map((c) => {
      // leadTelefone vem do join com leads(telefone) logo acima.
      const leadsRel = c.leads as unknown as
        | { nome_crm: string | null; telefone: string | null }[]
        | { nome_crm: string | null; telefone: string | null }
        | null;
      const lead = Array.isArray(leadsRel) ? leadsRel[0] : leadsRel;
      const elegibilidade = elegibilidadePorConversa.get(c.id);

      return mapConversaAnalisada(
        {
          id: c.id,
          iniciada_em: c.iniciada_em,
          etapa_playbook: c.etapa_playbook,
          leadNome: lead?.nome_crm ?? null,
          leadTelefone: lead?.telefone ?? null,
          totalMensagens: elegibilidade?.total_mensagens ?? 0,
          mensagensDoLead: elegibilidade?.mensagens_lead ?? 0,
          substituida_por_id: c.substituida_por_id,
        },
        analisesPorConversa.get(c.id),
      );
    });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <Link
          href={`/corretores?inicio=${inicio}&fim=${fim}`}
          className="text-sm font-medium text-navy-600 hover:underline"
        >
          ← Corretores
        </Link>
        <h1 className="text-2xl font-extrabold text-navy-900 mt-1">{ranking.corretor.nome_crm}</h1>
        <p className="text-sm text-text-secondary">
          {ranking.totalConversas} conversas analisadas na quinzena atual
        </p>
      </div>

      <CorretorAnalises
        conversas={conversas}
        insight={insight ?? null}
        corretorId={id}
        corretorNome={ranking.corretor.nome_crm}
        periodo={{ inicio, fim }}
        apresentacoesIniciais={apresentacoes}
        filtro={<PeriodoCorretoresFiltro />}
      />
    </div>
  );
}
