import { NextResponse } from "next/server";
import { createServiceClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { getDashboardSession } from "@/lib/session";

async function autorizado() {
  return (await getDashboardSession())?.role === "admin";
}

export async function GET() {
  if (!(await autorizado())) return NextResponse.json({ erro: "Não autorizado" }, { status: 403 });
  const supabase = createServiceClient();
  const [permissoesResult, corretoresResult] = await Promise.all([
    supabase.from("usuarios_permissoes").select("auth_user_id, papel"),
    supabase.from("corretores").select("auth_user_id, nome_crm").not("auth_user_id", "is", null),
  ]);
  if (permissoesResult.error || corretoresResult.error) {
    return NextResponse.json({ erro: permissoesResult.error?.message ?? corretoresResult.error?.message }, { status: 500 });
  }
  const usuarios = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    usuarios.push(...data.users);
    if (data.users.length < 200) break;
  }
  const papeis = new Map((permissoesResult.data ?? []).map((p) => [p.auth_user_id, p.papel]));
  const vinculos = new Map((corretoresResult.data ?? []).map((c) => [c.auth_user_id, c.nome_crm]));
  return NextResponse.json({
    usuarios: usuarios.filter((u) => u.email).map((u) => ({
      id: u.id,
      email: u.email,
      papel: papeis.get(u.id) ?? null,
      corretor: vinculos.get(u.id) ?? null,
    })).sort((a, b) => (a.email ?? "").localeCompare(b.email ?? "")),
  });
}

export async function PATCH(req: Request) {
  if (!(await autorizado())) return NextResponse.json({ erro: "Não autorizado" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.userId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.userId) || !["admin", "gestor", null].includes(body.papel)) {
    return NextResponse.json({ erro: "userId ou papel inválido" }, { status: 400 });
  }
  const auth = await createSupabaseServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (user?.id === body.userId && body.papel !== "admin") {
    return NextResponse.json({ erro: "Você não pode remover seu próprio acesso de administrador." }, { status: 409 });
  }
  const supabase = createServiceClient();
  const { data: alvo, error: alvoError } = await supabase.auth.admin.getUserById(body.userId);
  if (alvoError || !alvo.user) return NextResponse.json({ erro: "Usuário não encontrado" }, { status: 404 });
  const { data: vinculo, error: vinculoError } = await supabase.from("corretores").select("id").eq("auth_user_id", body.userId).maybeSingle();
  if (vinculoError) return NextResponse.json({ erro: vinculoError.message }, { status: 500 });
  if (vinculo) return NextResponse.json({ erro: "Usuário vinculado a corretor. Desvincule antes de atribuir um papel." }, { status: 409 });
  const resultado = body.papel === null
    ? await supabase.from("usuarios_permissoes").delete().eq("auth_user_id", body.userId)
    : await supabase.from("usuarios_permissoes").upsert({ auth_user_id: body.userId, papel: body.papel });
  if (resultado.error) return NextResponse.json({ erro: resultado.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
