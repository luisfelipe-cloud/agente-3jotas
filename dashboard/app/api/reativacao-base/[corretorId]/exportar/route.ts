import { createServiceClient } from "@/lib/supabase/server";
import { getDashboardSession } from "@/lib/session";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function csv(valor: string): string {
  return `"${valor.replace(/"/g, '""')}"`;
}

// Exporta em CSV os leads que não atenderam ou ainda não têm resposta
// (atendeu = false ou null) num período, pra reforço manual/repescagem.
export async function GET(req: Request, { params }: { params: Promise<{ corretorId: string }> }) {
  const { corretorId } = await params;

  const session = await getDashboardSession();
  if (session?.role === "corretor" && session.corretorId !== corretorId) {
    return new Response("Não autorizado", { status: 403 });
  }

  const url = new URL(req.url);
  const inicio = url.searchParams.get("inicio") ?? hojeISO();
  const fim = url.searchParams.get("fim") ?? hojeISO();

  const supabase = createServiceClient();

  const { data: corretor } = await supabase.from("corretores").select("nome_crm").eq("id", corretorId).maybeSingle();
  if (!corretor) return new Response("Corretor não encontrado", { status: 404 });

  const { data, error } = await supabase
    .from("campanha_reativacao_leads")
    .select(
      "nome, telefone, status_importado, etapa_funil_importado, atendeu, deseja_continuar, campanhas_reativacao!inner(data, corretor_id)",
    )
    .eq("campanhas_reativacao.corretor_id", corretorId)
    .gte("campanhas_reativacao.data", inicio)
    .lte("campanhas_reativacao.data", fim)
    .or("atendeu.is.null,atendeu.eq.false")
    .order("data", { referencedTable: "campanhas_reativacao", ascending: false });

  if (error) return new Response(`Erro ao exportar: ${error.message}`, { status: 500 });

  const linhas = (data ?? []).map((l) => {
    const campanhaRel = l.campanhas_reativacao as unknown as { data: string } | { data: string }[];
    const campanha = Array.isArray(campanhaRel) ? campanhaRel[0] : campanhaRel;
    const atendeuTexto = l.atendeu === false ? "Não atendeu" : "Sem resposta";
    const desejaContinuarTexto = l.deseja_continuar === true ? "Sim" : l.deseja_continuar === false ? "Não" : "";

    return [
      csv(l.nome ?? ""),
      csv(l.telefone),
      csv(campanha.data),
      csv(atendeuTexto),
      csv(desejaContinuarTexto),
      csv(l.status_importado ?? ""),
      csv(l.etapa_funil_importado ?? ""),
    ].join(",");
  });

  const cabecalho = ["Nome", "Telefone", "Data", "Atendeu", "Deseja continuar", "Status", "Etapa do funil"]
    .map(csv)
    .join(",");

  // BOM no início — sem isso o Excel abre acentos em pt-BR quebrados.
  const conteudo = "﻿" + [cabecalho, ...linhas].join("\r\n");

  const nomeArquivo = `reativacao-${corretor.nome_crm.replace(/[^a-zA-Z0-9]+/g, "-")}-${inicio}-a-${fim}.csv`;

  return new Response(conteudo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
