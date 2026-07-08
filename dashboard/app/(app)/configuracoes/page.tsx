import { createServiceClient } from "@/lib/supabase/server";
import { mapParametroCriterio, mapPlaybookScript } from "@/lib/mappers";
import { ConfiguracoesTabs } from "@/components/ConfiguracoesTabs";

export default async function ConfiguracoesPage() {
  const supabase = createServiceClient();

  const [{ data: parametrosRows, error: parametrosError }, { data: playbooksRows, error: playbooksError }] = await Promise.all([
    supabase.from("parametros_analise").select("criterio, nota_maxima, peso_percentual, descricao, ativo").order("criterio"),
    supabase.from("playbooks").select("id, etapa, conteudo, ativo, created_at, updated_at").order("created_at"),
  ]);

  if (parametrosError) throw new Error(`Erro ao carregar critérios: ${parametrosError.message}`);
  if (playbooksError) throw new Error(`Erro ao carregar playbooks: ${playbooksError.message}`);

  const parametros = (parametrosRows ?? []).map(mapParametroCriterio);
  const playbooks = (playbooksRows ?? []).map(mapPlaybookScript);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">Configurações</h1>
        <p className="text-sm text-text-secondary">Parâmetros e scripts de playbook usados pelo motor de análise</p>
      </div>

      <ConfiguracoesTabs parametrosIniciais={parametros} playbooksIniciais={playbooks} />
    </div>
  );
}
