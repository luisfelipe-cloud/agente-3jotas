import { NavSidebar } from "@/components/nav/NavSidebar";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Rotas dentro do grupo (app) têm sidebar + exigem login (garantido pelo
// middleware). /login fica fora do grupo, sem essa moldura.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-full flex">
      <NavSidebar userEmail={user?.email ?? null} />
      <main className="flex-1 px-8 py-8 min-w-0">{children}</main>
    </div>
  );
}
