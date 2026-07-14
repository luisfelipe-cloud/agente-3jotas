import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { montarApresentacaoHtml } from "@/lib/presentation";
import { CRITERIOS, type CriterioKey } from "@/lib/types";

// GET ?corretorId=... — lista as apresentações já geradas pra esse corretor.
export async function GET(req: Request) {
  const corretorId = new URL(req.url).searchParams.get("corretorId");
  if (!corretorId) {
    return NextResponse.json({ ok: false, erro: "corretorId é obrigatório" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("apresentacoes")
    .select("id, titulo, data_inicio, data_fim, criado_em")
    .eq("corretor_id", corretorId)
    .order("criado_em", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, apresentacoes: data });
}

// POST — gera uma nova apresentação a partir dos dados já filtrados no
// período que o cliente está vendo (a mesma janela de datas do filtro
// De/Até), sem precisar refazer as queries de análise no servidor.
export async function POST(req: Request) {
  const body = await req.json();

  const { corretorId, corretorNome, dataInicio, dataFim, mediasPorCriterio, conversas, insight } = body as {
    corretorId?: string;
    corretorNome?: string;
    dataInicio?: string;
    dataFim?: string;
    mediasPorCriterio?: Record<CriterioKey, number>;
    conversas?: {
      leadNome: string;
      leadTelefone: string | null;
      iniciadaEm: string;
      criterios: Record<CriterioKey, { score: number; evidencia: string; justificativa: string }>;
    }[];
    insight?: string | null;
  };

  if (!corretorId || !corretorNome || !dataInicio || !dataFim || !mediasPorCriterio || !conversas) {
    return NextResponse.json({ ok: false, erro: "dados incompletos para gerar a apresentação" }, { status: 400 });
  }

  for (const c of CRITERIOS) {
    if (typeof mediasPorCriterio[c] !== "number") {
      return NextResponse.json({ ok: false, erro: `mediasPorCriterio.${c} ausente` }, { status: 400 });
    }
  }

  const html = montarApresentacaoHtml({ corretorNome, dataInicio, dataFim, mediasPorCriterio, conversas, insight: insight ?? null });
  const titulo = `${dataInicio.split("-").reverse().join("/")} a ${dataFim.split("-").reverse().join("/")}`;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("apresentacoes")
    .insert({ corretor_id: corretorId, titulo, data_inicio: dataInicio, data_fim: dataFim, html })
    .select("id, titulo, data_inicio, data_fim, criado_em")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, apresentacao: data });
}
