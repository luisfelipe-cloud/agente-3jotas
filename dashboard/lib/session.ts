import { createServiceClient, createSupabaseServerClient } from "@/lib/supabase/server";

export type DashboardSession =
  | { role: "admin" }
  | { role: "gestor" }
  | { role: "corretor"; corretorId: string; nomeCrm: string }
  | { role: "pendente" };

// Corretor é definido pelo vínculo; demais acessos exigem papel explícito.
export async function getDashboardSession(): Promise<DashboardSession | null> {
  const supabaseAuth = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) return null;

  const supabase = createServiceClient();
  const { data: corretor, error: corretorError } = await supabase
    .from("corretores")
    .select("id, nome_crm")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (corretorError) throw new Error(`Erro ao verificar vínculo: ${corretorError.message}`);

  if (corretor) {
    return { role: "corretor", corretorId: corretor.id, nomeCrm: corretor.nome_crm };
  }

  const { data: permissao, error: permissaoError } = await supabase
    .from("usuarios_permissoes")
    .select("papel")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (permissaoError) throw new Error(`Erro ao verificar permissão: ${permissaoError.message}`);
  if (permissao?.papel === "admin" || permissao?.papel === "gestor") return { role: permissao.papel };
  return { role: "pendente" };
}
