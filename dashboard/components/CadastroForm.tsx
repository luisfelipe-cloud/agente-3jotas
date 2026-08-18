"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/Input";
import { IconMail, IconLock, IconUsers } from "@/components/ui/icons";

function mensagemErro(erro: string): string {
  if (erro.includes("already registered") || erro.includes("already exists")) {
    return "Já existe uma conta com esse email. Tente entrar em vez de cadastrar.";
  }
  if (erro.includes("Password should be at least")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  return erro;
}

export function CadastroForm() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [cadastrando, setCadastrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setCadastrando(true);
    setErro(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome, pendente_vinculo: true } },
    });

    if (error) {
      setErro(mensagemErro(error.message));
      setCadastrando(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={cadastrar} className="space-y-4">
      <Input
        type="text"
        label="Nome"
        labelClassName="text-white"
        placeholder="Seu nome completo"
        icon={<IconUsers />}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        autoFocus
        required
      />
      <Input
        type="email"
        label="Email"
        labelClassName="text-white"
        placeholder="voce@tresjotas.com.br"
        icon={<IconMail />}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
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
        disabled={cadastrando}
        className="w-full h-10 rounded-md bg-coral-600 text-white text-sm font-semibold hover:bg-coral-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {cadastrando ? "Cadastrando..." : "Cadastrar"}
      </button>
    </form>
  );
}
