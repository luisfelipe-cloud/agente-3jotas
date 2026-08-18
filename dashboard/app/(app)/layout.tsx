import { NavSidebar } from "@/components/nav/NavSidebar";
import { AguardandoVinculoScreen } from "@/components/AguardandoVinculoScreen";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDashboardSession } from "@/lib/session";

// Rotas dentro do grupo (app) têm sidebar + exigem login (garantido pelo
// middleware). /login fica fora do grupo, sem essa moldura.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const session = await getDashboardSession();

  return (
    <div className="min-h-full flex">
      <NavSidebar userEmail={user?.email ?? null} session={session} />
      <main className="flex-1 px-8 py-8 min-w-0">
        {session?.role === "pendente" ? <AguardandoVinculoScreen /> : children}
      </main>
    </div>
  );
}
