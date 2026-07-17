import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Protege todas as rotas do dashboard — sem sessão válida, redireciona pra
// /login. Usuários são criados manualmente no painel do Supabase
// (Authentication > Users), não existe cadastro público aqui.
//
// Next.js 16 renomeou "middleware" pra "proxy" (arquivo e função) — este
// projeto usa a convenção nova (proxy.ts / export function proxy).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // icon/apple-icon: rotas geradas em código (app/icon.tsx) pro favicon da
  // aba — sem essa exclusão, quem não está logado via redirect pra /login
  // ao carregar a página e o ícone nunca aparece.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.png$).*)"],
};
