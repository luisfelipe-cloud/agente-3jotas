"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { IconLogout } from "@/components/ui/icons";

export function AguardandoVinculoScreen() {
  const router = useRouter();

  async function sair() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-sm text-center space-y-4">
        <h1 className="text-xl font-bold text-navy-900">Cadastro recebido!</h1>
        <p className="text-sm text-text-secondary">
          Sua conta ainda não foi liberada. Peça pro seu gestor vincular seu acesso em Configurações → Usuários.
        </p>
        <button
          onClick={sair}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-text-secondary hover:bg-navy-50/60 hover:text-navy-900 transition-colors"
        >
          <IconLogout className="h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  );
}
