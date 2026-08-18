import { createServiceClient, createSupabaseServerClient } from "@/lib/supabase/server";

export type DashboardSession =
  | { role: "admin" }
  | { role: "corretor"; corretorId: string; nomeCrm: string }
  | { role: "pendente" };

// Um usuário é "corretor" se existir uma linha em `corretores` vinculada ao
// seu auth_user_id; qualquer outro usuário autenticado é "admin" — não
// existe coluna de role, o vínculo em `corretores` é o único sinal.
export async function getDashboardSession(): Promise<DashboardSession | null> {
  const supabaseAuth = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) return null;

  const supabase = createServiceClient();
  const { data: corretor } = await supabase
    .from("corretores")
    .select("id, nome_crm")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (corretor) {
    return { role: "corretor", corretorId: corretor.id, nomeCrm: corretor.nome_crm };
  }

  // Conta criada via /cadastro (autocadastro do corretor) ainda sem vínculo
  // feito pelo admin em Configurações > Usuários — não pode cair em "admin"
  // (contas admin de verdade nunca têm essa flag, só as criadas pelo signUp
  // público em CadastroForm.tsx).
  if (user.user_metadata?.pendente_vinculo === true) {
    return { role: "pendente" };
  }

  return { role: "admin" };
}
