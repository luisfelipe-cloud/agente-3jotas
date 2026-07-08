import { createBrowserClient } from "@supabase/ssr";

// Uso exclusivo em Client Components ("use client") — login/logout. A sessão
// fica em cookies (via @supabase/ssr), então o middleware e os Server
// Components enxergam o mesmo login sem precisar repassar token manualmente.
export function createSupabaseBrowserClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
