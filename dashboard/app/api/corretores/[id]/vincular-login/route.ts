import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getDashboardSession } from "@/lib/session";

// admin.listUsers() não tem filtro por email na v2 do supabase-js — pagina
// e filtra em código. Base de usuários é pequena (só admins + corretores
// vinculados), então isso não vira gargalo.
async function buscarUsuarioPorEmail(supabase: ReturnType<typeof createServiceClient>, email: string) {
  const alvo = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);

    const encontrado = data.users.find((u) => u.email?.toLowerCase() === alvo);
    if (encontrado) return encontrado;

    if (data.users.length < perPage) return null;
    page++;
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDashboardSession();
  if (session?.role === "corretor") {
    return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  if (typeof body.loginEmail !== "string") {
    return NextResponse.json({ ok: false, erro: "loginEmail é obrigatório (string vazia pra desvincular)" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const loginEmail = body.loginEmail.trim();

  let authUserId: string | null = null;

  if (loginEmail) {
    let usuario;
    try {
      usuario = await buscarUsuarioPorEmail(supabase, loginEmail);
    } catch (err) {
      return NextResponse.json({ ok: false, erro: err instanceof Error ? err.message : "Falha ao buscar usuário" }, { status: 500 });
    }

    if (!usuario) {
      return NextResponse.json(
        { ok: false, erro: "Nenhum usuário encontrado com esse email. Crie o usuário em Supabase Auth primeiro." },
        { status: 400 },
      );
    }

    authUserId = usuario.id;
  }

  const { error } = await supabase.from("corretores").update({ auth_user_id: authUserId }).eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: false, erro: "Esse email já está vinculado a outro corretor." }, { status: 409 });
    }
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
