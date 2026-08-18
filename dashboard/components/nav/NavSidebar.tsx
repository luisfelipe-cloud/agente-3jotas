"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { IconGrid, IconUsers, IconSettings, IconLogout, IconPhoneCall } from "@/components/ui/icons";
import type { DashboardSession } from "@/lib/session";

const TABS_ADMIN = [
  { href: "/", label: "Dashboard", Icon: IconGrid },
  { href: "/corretores", label: "Corretores", Icon: IconUsers },
  { href: "/reativacao-base", label: "Reativação", Icon: IconPhoneCall },
  { href: "/configuracoes", label: "Configurações", Icon: IconSettings },
];

function tabsParaSessao(session: DashboardSession | null) {
  if (session?.role === "corretor") {
    return [
      { href: `/corretores/${session.corretorId}`, label: "Corretores", Icon: IconUsers },
      { href: `/reativacao-base/${session.corretorId}`, label: "Reativação", Icon: IconPhoneCall },
    ];
  }
  // Fail-closed: sessão nula (não deve acontecer dentro do grupo (app),
  // já garantido pelo proxy.ts) não mostra tabs extras em vez de assumir admin.
  return session?.role === "admin" ? TABS_ADMIN : [];
}

export function NavSidebar({ userEmail, session }: { userEmail: string | null; session: DashboardSession | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const tabs = tabsParaSessao(session);

  async function sair() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-border h-screen sticky top-0 flex flex-col overflow-y-auto">
      <div className="px-5 py-6">
        <div className="px-6 py-3 flex justify-center">
          <Image
            src="/tresjotas_logo-removebg-preview.png"
            alt="Três Jotas"
            width={160}
            height={58}
            priority
            className="w-full h-auto"
          />
        </div>
      </div>
      <div className="border-t border-border mx-5" />
      <nav className="flex flex-col gap-1 px-3 pt-4">
        {tabs.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors border-l-2 ${
                active
                  ? "bg-navy-50 text-navy-900 border-coral-600"
                  : "text-text-secondary border-transparent hover:bg-navy-50/60 hover:text-navy-900"
              }`}
            >
              <tab.Icon className={`h-4 w-4 shrink-0 ${active ? "text-coral-600" : "text-text-secondary"}`} />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-border p-3 space-y-1">
        {userEmail && <p className="px-2 text-xs text-text-secondary truncate">{userEmail}</p>}
        <button
          onClick={sair}
          className="w-full flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-navy-50/60 hover:text-navy-900 transition-colors"
        >
          <IconLogout className="h-4 w-4 shrink-0" />
          Sair
        </button>
      </div>
    </aside>
  );
}
