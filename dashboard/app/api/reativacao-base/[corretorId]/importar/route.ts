import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createServiceClient } from "@/lib/supabase/server";

// Linha crua do CSV de "negócios" exportado do Clint — só os campos que
// interessam. Diferente do fluxo antigo (removido), não tenta casar
// corretor pelo nome: o corretor já foi escolhido antes de chegar aqui
// (fluxo corretor > lista), então toda linha do CSV vira lead dele.
interface LinhaCsv {
  name?: string;
  phone?: string;
  complete_phone?: string;
  status?: string;
  stage?: string;
}

export async function POST(req: Request, { params }: { params: Promise<{ corretorId: string }> }) {
  const { corretorId } = await params;
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

  const linhasValidas: LinhaCsv[] = [];
  let semTelefone = 0;
  for (const linha of resultado.data) {
    if (linha.complete_phone || linha.phone) linhasValidas.push(linha);
    else semTelefone++;
  }

  const supabase = createServiceClient();

  const { data: corretor, error: corretorError } = await supabase
    .from("corretores")
    .select("id")
    .eq("id", corretorId)
    .maybeSingle();
  if (corretorError) return NextResponse.json({ ok: false, erro: corretorError.message }, { status: 500 });
  if (!corretor) return NextResponse.json({ ok: false, erro: "Corretor não encontrado" }, { status: 404 });

  const { data: campanha, error: campanhaError } = await supabase
    .from("campanhas_reativacao")
    .upsert({ corretor_id: corretorId, data: dataStr }, { onConflict: "corretor_id,data" })
    .select("id")
    .single();

  if (campanhaError || !campanha) {
    return NextResponse.json({ ok: false, erro: `falha ao criar campanha: ${campanhaError?.message}` }, { status: 500 });
  }

  // Reupload do mesmo dia substitui a lista inteira — ver mesmo comentário
  // no fluxo antigo: mais simples e previsível que mesclar linha a linha.
  await supabase.from("campanha_reativacao_leads").delete().eq("campanha_id", campanha.id);

  if (linhasValidas.length > 0) {
    const { error: leadsError } = await supabase.from("campanha_reativacao_leads").insert(
      linhasValidas.map((l) => ({
        campanha_id: campanha.id,
        nome: l.name ?? null,
        telefone: (l.complete_phone || l.phone)!,
        status_importado: l.status ?? null,
        etapa_funil_importado: l.stage ?? null,
      })),
    );

    if (leadsError) return NextResponse.json({ ok: false, erro: `falha ao gravar leads: ${leadsError.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, campanhaId: campanha.id, totalLeads: linhasValidas.length, semTelefone });
}
