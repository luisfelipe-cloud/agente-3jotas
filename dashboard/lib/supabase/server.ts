import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Uso exclusivo em Server Components / API routes — nunca importar em um
// componente "use client". Usa a service_role key (ignora RLS), então essa
// chave não pode ter o prefixo NEXT_PUBLIC_ (não é enviada ao browser).
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas");
  }

  return createClient(url, key);
}

// Client com a sessão do usuário logado (cookies) — só pra saber quem está
// logado (auth.getUser()) em Server Components, ex: mostrar o email na
// sidebar. Não usar pra ler dados de negócio (os dados continuam vindo do
// createServiceClient acima); o refresh de sessão já é feito no middleware,
// então aqui o setAll é um no-op.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // No-op: cookies não podem ser escritos durante a renderização de
        // Server Components. O middleware já cuida de renovar a sessão.
      },
    },
  });
}
