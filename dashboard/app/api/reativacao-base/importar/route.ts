import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createServiceClient } from "@/lib/supabase/server";

// Linha crua do CSV de "negócios" exportado do Clint — só os campos que
// interessam pra reativação. O sistema não filtra "perdido": confia que o
// CSV já veio filtrado de lá (decisão explícita, ver plano da feature).
interface LinhaCsv {
  name?: string;
  phone?: string;
  complete_phone?: string;
  status?: string;
  stage?: string;
  user_name?: string;
}

// Remove acento, colchetes tipo "[CLOSER] "/"[SDR] ", pontuação e TODO
// espaço, deixa maiúsculo — pra casar "[CLOSER] WESLIANNEBERNADINO" (o
// Clint exporta o nome do usuário sem espaço entre nome e sobrenome) com o
// "Weslianne Bernadino" cadastrado em corretores.nome_crm. Testado contra
// um CSV real do Clint: sem remover o espaço também, essas duas formas
// nunca batem ("WESLIANNEBERNADINO" vs "WESLIANNE BERNADINO").
function normalizarNome(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
}

export async function POST(req: Request) {
  const form = await req.formData();
  const arquivo = form.get("arquivo");
  const dataStr = form.get("data");

  if (!(arquivo instanceof File) || typeof dataStr !== "string" || !dataStr) {
    return NextResponse.json({ ok: false, erro: "Envie 'arquivo' (CSV) e 'data' (yyyy-mm-dd)." }, { status: 400 });
  }

  const texto = await arquivo.text();
  const resultado = Papa.parse<LinhaCsv>(texto, { header: true, skipEmptyLines: true });

  if (resultado.errors.length) {
    return NextResponse.json(
      { ok: false, erro: `Falha ao ler o CSV: ${resultado.errors[0].message}` },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  const { data: corretores, error: corretoresError } = await supabase.from("corretores").select("id, nome_crm");
  if (corretoresError) {
    return NextResponse.json({ ok: false, erro: corretoresError.message }, { status: 500 });
  }

  const corretorPorNome = new Map((corretores ?? []).map((c) => [normalizarNome(c.nome_crm), c]));

  const linhasPorCorretor = new Map<string, LinhaCsv[]>();
  const naoEncontrados: { userName: string; nome: string | null }[] = [];
  const semTelefone: { nome: string | null }[] = [];

  for (const linha of resultado.data) {
    const telefone = linha.complete_phone || linha.phone;
    if (!telefone) {
      semTelefone.push({ nome: linha.name ?? null });
      continue;
    }

    const userName = linha.user_name?.trim();
    if (!userName) {
      naoEncontrados.push({ userName: "(vazio)", nome: linha.name ?? null });
      continue;
    }

    const corretor = corretorPorNome.get(normalizarNome(userName));
    if (!corretor) {
      naoEncontrados.push({ userName, nome: linha.name ?? null });
      continue;
    }

    const lista = linhasPorCorretor.get(corretor.id) ?? [];
    lista.push(linha);
    linhasPorCorretor.set(corretor.id, lista);
  }

  const campanhasCriadas: { corretorId: string; corretorNome: string; campanhaId: string; totalLeads: number }[] = [];

  for (const [corretorId, linhas] of linhasPorCorretor) {
    const { data: campanha, error: campanhaError } = await supabase
      .from("campanhas_reativacao")
      .upsert({ corretor_id: corretorId, data: dataStr }, { onConflict: "corretor_id,data" })
      .select("id")
      .single();

    if (campanhaError || !campanha) {
      return NextResponse.json({ ok: false, erro: `falha ao criar campanha: ${campanhaError?.message}` }, { status: 500 });
    }

    // Reupload do mesmo dia substitui a lista inteira — mais simples e
    // previsível que tentar mesclar/dedupear linha a linha; se o corretor já
    // tinha respondido algo nesse dia antes do reupload, essas respostas se
    // perdem (aceitável pro v1, é o mesmo CSV vindo de novo).
    await supabase.from("campanha_reativacao_leads").delete().eq("campanha_id", campanha.id);

    const { error: leadsError } = await supabase.from("campanha_reativacao_leads").insert(
      linhas.map((l) => ({
        campanha_id: campanha.id,
        nome: l.name ?? null,
        telefone: (l.complete_phone || l.phone)!,
        status_importado: l.status ?? null,
        etapa_funil_importado: l.stage ?? null,
      })),
    );

    if (leadsError) {
      return NextResponse.json({ ok: false, erro: `falha ao gravar leads: ${leadsError.message}` }, { status: 500 });
    }

    const corretorNome = corretores!.find((c) => c.id === corretorId)!.nome_crm;
    campanhasCriadas.push({ corretorId, corretorNome, campanhaId: campanha.id, totalLeads: linhas.length });
  }

  return NextResponse.json({ ok: true, campanhas: campanhasCriadas, naoEncontrados, semTelefone });
}
