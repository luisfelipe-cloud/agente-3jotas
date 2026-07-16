import { createServiceClient } from "@/lib/supabase/server";
import { CRITERIOS, type CriterioKey, type DashboardOverview, type PontoAtencao, type CorretorComErros } from "@/lib/types";

function inicioDia(data: Date) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function buscarDashboardOverview(): Promise<DashboardOverview> {
  const supabase = createServiceClient();

  const hoje = inicioDia(new Date());
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const seteDiasAtras = new Date(hoje);
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 6);
  const quinzeDiasAtras = new Date(hoje);
  quinzeDiasAtras.setDate(quinzeDiasAtras.getDate() - 14);
  const doisDiasAtras = new Date(hoje);
  doisDiasAtras.setDate(doisDiasAtras.getDate() - 2);

  // Um dia de atividade normal já passa de 1000 mensagens — buscar as linhas
  // cruas (só pra contar por dia depois) batia no limite padrão de 1000
  // linhas do Supabase/PostgREST sem erro nenhum, e como a ordem retornada
  // não é cronológica, os dias mais recentes (hoje, ontem) simplesmente
  // desapareciam do gráfico de interações. Conta direto no banco por dia
  // (count exact/head, sem transferir linha nenhuma) em vez de trazer tudo
  // pro JS e filtrar aqui.
  const diasJanela: { inicio: Date; fim: Date }[] = [];
  for (let i = 6; i >= 0; i--) {
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - i);
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 1);
    diasJanela.push({ inicio, fim });
  }

  const [
    { count: conversasPendentesAnalise, error: pendentesError },
    { data: analisesQuinzenaRaw, error: analisesError },
    contagensMensagensPorDia,
  ] = await Promise.all([
    supabase.from("analises").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    supabase
      .from("analises")
      .select("*, conversas(corretor_id, corretores(nome_crm))")
      .eq("status", "concluida")
      .gte("analisado_em", quinzeDiasAtras.toISOString())
      .limit(5000),
    Promise.all(
      diasJanela.map(({ inicio, fim }) =>
        supabase
          .from("mensagens")
          .select("id", { count: "exact", head: true })
          .gte("enviada_em", inicio.toISOString())
          .lt("enviada_em", fim.toISOString()),
      ),
    ),
  ]);

  if (pendentesError) throw new Error(`Erro ao carregar dashboard: ${pendentesError.message}`);
  if (analisesError) throw new Error(`Erro ao carregar dashboard: ${analisesError.message}`);
  const erroContagem = contagensMensagensPorDia.find((r) => r.error);
  if (erroContagem?.error) throw new Error(`Erro ao carregar dashboard: ${erroContagem.error.message}`);

  const analises = analisesQuinzenaRaw ?? [];

  const scoreDe = (a: (typeof analises)[number], c: CriterioKey): number | null => {
    const v = a[`${c}_score`];
    return v === null || v === undefined ? null : (v as number);
  };

  // A análise sempre roda depois da meia-noite (mesmo avaliando conversas de
  // ontem), então "hoje" é a janela certa pra ver o que já foi processado —
  // filtrar por "ontem" deixava esse card quase sempre vazio.
  const analisesHoje = analises.filter(
    (a) => a.analisado_em && new Date(a.analisado_em) >= hoje && new Date(a.analisado_em) < amanha,
  );
  const analisesOntem = analises.filter(
    (a) => a.analisado_em && new Date(a.analisado_em) >= ontem && new Date(a.analisado_em) < hoje,
  );

  const distribuicaoPorCriterio = Object.fromEntries(
    CRITERIOS.map((c) => {
      const valores = analisesHoje.map((a) => scoreDe(a, c)).filter((v): v is number => v !== null);
      const media = valores.length ? valores.reduce((x, y) => x + y, 0) / valores.length : 0;
      return [c, media];
    }),
  ) as Record<CriterioKey, number>;

  const todosScores = CRITERIOS.flatMap((c) => analises.map((a) => scoreDe(a, c)).filter((v): v is number => v !== null));
  const mediaGeralQuinzena = todosScores.length ? todosScores.reduce((x, y) => x + y, 0) / todosScores.length : 0;

  const pontosAtencao: PontoAtencao[] = [];
  for (const a of analises) {
    if (!a.analisado_em || new Date(a.analisado_em) < doisDiasAtras) continue;
    const conversaRel = a.conversas as { corretor_id: string; corretores: { nome_crm: string } | null } | null;
    if (!conversaRel) continue;

    for (const c of CRITERIOS) {
      const score = scoreDe(a, c);
      if (score === null || score >= 1) continue;
      pontosAtencao.push({
        corretorId: conversaRel.corretor_id,
        corretorNome: conversaRel.corretores?.nome_crm ?? "Corretor",
        criterio: c,
        descricao: a[`${c}_justificativa`] || "Critério não atendido.",
        conversaId: a.conversa_id,
      });
    }
  }

  const errosPorCorretor = new Map<string, { nome: string; total: number; porCriterio: Record<CriterioKey, number> }>();
  for (const a of analises) {
    const conversaRel = a.conversas as { corretor_id: string; corretores: { nome_crm: string } | null } | null;
    if (!conversaRel) continue;

    const entry = errosPorCorretor.get(conversaRel.corretor_id) ?? {
      nome: conversaRel.corretores?.nome_crm ?? "Corretor",
      total: 0,
      porCriterio: Object.fromEntries(CRITERIOS.map((c) => [c, 0])) as Record<CriterioKey, number>,
    };

    for (const c of CRITERIOS) {
      const score = scoreDe(a, c);
      if (score !== null && score < 5) {
        entry.total++;
        entry.porCriterio[c]++;
      }
    }

    errosPorCorretor.set(conversaRel.corretor_id, entry);
  }

  const corretoresComMaisErros: CorretorComErros[] = [...errosPorCorretor.entries()]
    .filter(([, v]) => v.total > 0)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([corretorId, v]) => {
      const criterioMaisFraco = CRITERIOS.reduce((pior, atual) => (v.porCriterio[atual] > v.porCriterio[pior] ? atual : pior));
      return { corretorId, corretorNome: v.nome, totalErros: v.total, criterioMaisFraco };
    });

  const analises7dias = analises.filter((a) => a.analisado_em && new Date(a.analisado_em) >= seteDiasAtras);
  const tendenciaDiaria: DashboardOverview["tendenciaDiaria"] = diasJanela.map(({ inicio, fim }, i) => {
    const scoresDia = analises7dias
      .filter((a) => {
        const t = new Date(a.analisado_em).getTime();
        return t >= inicio.getTime() && t < fim.getTime();
      })
      .flatMap((a) => CRITERIOS.map((c) => scoreDe(a, c)).filter((v): v is number => v !== null));

    return {
      data: inicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      interacoes: contagensMensagensPorDia[i].count ?? 0,
      mediaScore: scoresDia.length ? scoresDia.reduce((x, y) => x + y, 0) / scoresDia.length : 0,
    };
  });

  const variacaoChatsAnalisadosPercentual = analisesOntem.length
    ? Math.round(((analisesHoje.length - analisesOntem.length) / analisesOntem.length) * 100)
    : 0;

  return {
    chatsAnalisadosHoje: analisesHoje.length,
    variacaoChatsAnalisadosPercentual,
    conversasPendentesAnalise: conversasPendentesAnalise ?? 0,
    mediaGeralQuinzena,
    tendenciaDiaria,
    pontosAtencao: pontosAtencao.slice(0, 8),
    corretoresComMaisErros,
    distribuicaoPorCriterio,
  };
}
