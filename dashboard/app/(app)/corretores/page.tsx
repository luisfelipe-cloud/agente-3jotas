import { createServiceClient } from "@/lib/supabase/server";
import { mapCorretorRanking } from "@/lib/mappers";
import { CorretoresManager } from "@/components/CorretoresManager";
import { PeriodoCorretoresFiltro } from "@/components/PeriodoCorretoresFiltro";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function CorretoresPage({
  searchParams,
}: {
  searchParams: Promise<{ inicio?: string; fim?: string }>;
}) {
  const sp = await searchParams;
  const inicio = sp.inicio ?? hojeISO();
  const fim = sp.fim ?? hojeISO();

  const dataInicio = new Date(`${inicio}T00:00:00`);
  const dataFim = new Date(`${fim}T23:59:59.999`);

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("corretor_ranking", {
    data_inicio: dataInicio.toISOString(),
    data_fim: dataFim.toISOString(),
  });

  if (error) throw new Error(`Erro ao carregar corretores: ${error.message}`);

  const ranking = (data ?? []).map(mapCorretorRanking);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">Corretores</h1>
        <p className="text-sm text-text-secondary mt-1">
          Desempenho no período selecionado — selecione um card para ver o histórico completo
        </p>
      </div>

      <PeriodoCorretoresFiltro />

      <CorretoresManager ranking={ranking} />
    </div>
  );
}
