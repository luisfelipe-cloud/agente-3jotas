"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { IconCheck } from "@/components/ui/icons";
import { Toast, type ToastMensagem } from "@/components/ui/Toast";

export interface CorretorAcesso {
  id: string;
  nomeCrm: string;
  ativo: boolean;
  vinculado: boolean;
}

function LinhaCorretor({
  corretor,
  onVinculado,
  onDesvinculado,
  onErro,
}: {
  corretor: CorretorAcesso;
  onVinculado: (id: string) => void;
  onDesvinculado: (id: string) => void;
  onErro: (texto: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      const resp = await fetch(`/api/corretores/${corretor.id}/vincular-login`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginEmail: email.trim() }),
      });
      const dados = await resp.json();
      if (!resp.ok || dados.ok === false) throw new Error(dados.erro ?? "Falha ao vincular login");

      if (email.trim()) onVinculado(corretor.id);
      else onDesvinculado(corretor.id);
      setEmail("");
    } catch (err) {
      onErro(err instanceof Error ? err.message : "Falha ao vincular login");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card variant="elevated" className="flex items-center justify-between gap-4 !rounded-md">
      <div className="min-w-0">
        <p className="font-semibold text-text-primary truncate">
          {corretor.nomeCrm} {!corretor.ativo && <span className="text-xs text-text-secondary font-normal">· inativo</span>}
        </p>
        <div className="mt-1">
          {corretor.vinculado ? <Badge variant="success">Vinculado</Badge> : <Badge variant="neutral">Sem acesso</Badge>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={corretor.vinculado ? "Novo email (ou vazio pra desvincular)" : "Email de login"}
          className="w-64"
        />
        <IconButton label="Salvar" onClick={salvar} disabled={salvando}>
          <IconCheck />
        </IconButton>
      </div>
    </Card>
  );
}

export function UsuariosForm({ corretoresIniciais }: { corretoresIniciais: CorretorAcesso[] }) {
  const [corretores, setCorretores] = useState(corretoresIniciais);
  const [toast, setToast] = useState<ToastMensagem | null>(null);

  function marcarVinculado(id: string) {
    setCorretores((prev) => prev.map((c) => (c.id === id ? { ...c, vinculado: true } : c)));
    setToast({ tipo: "ok", texto: "Login vinculado com sucesso." });
  }

  function marcarDesvinculado(id: string) {
    setCorretores((prev) => prev.map((c) => (c.id === id ? { ...c, vinculado: false } : c)));
    setToast({ tipo: "ok", texto: "Login desvinculado." });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Vincule cada corretor a um usuário já criado em Supabase Auth (Authentication &gt; Users) pelo email — o
        corretor passa a ver só as próprias análises e reativações ao logar.
      </p>

      <div className="space-y-3">
        {corretores.map((c) => (
          <LinhaCorretor
            key={c.id}
            corretor={c}
            onVinculado={marcarVinculado}
            onDesvinculado={marcarDesvinculado}
            onErro={(texto) => setToast({ tipo: "erro", texto })}
          />
        ))}
      </div>

      {toast && <Toast mensagem={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
