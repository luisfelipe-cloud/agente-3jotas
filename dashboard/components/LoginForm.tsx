"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/Input";
import { IconMail, IconLock } from "@/components/ui/icons";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setErro(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

    if (error) {
      setErro(error.message === "Invalid login credentials" ? "Email ou senha incorretos." : error.message);
      setEntrando(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={entrar} className="space-y-4">
      <Input
        type="email"
        label="Email"
        labelClassName="text-white"
        placeholder="voce@tresjotas.com.br"
        icon={<IconMail />}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus
        required
      />
      <Input
        type="password"
        label="Senha"
        labelClassName="text-white"
        placeholder="••••••••"
        icon={<IconLock />}
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        required
      />

      {erro && <p className="text-sm text-white bg-black/10 rounded-md px-3 py-2">{erro}</p>}

      <button
        type="submit"
        disabled={entrando}
        className="w-full h-10 rounded-md bg-coral-600 text-white text-sm font-semibold hover:bg-coral-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {entrando ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
