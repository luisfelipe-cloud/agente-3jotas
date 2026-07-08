"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconButton } from "@/components/ui/IconButton";
import { IconRefresh } from "@/components/ui/icons";

export function SincronizarButton() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function sincronizar() {
    setCarregando(true);
    setMensagem(null);

    try {
      const resp = await fetch("/api/sync-conversas", { method: "POST" });
      const dados = await resp.json();

      if (!resp.ok || dados.ok === false) {
        setMensagem({ tipo: "erro", texto: typeof dados.erro === "string" ? dados.erro : "Falha ao sincronizar" });
        return;
      }

      setMensagem({
        tipo: "ok",
        texto: `${dados.chats_processados ?? 0} chats · ${dados.mensagens_gravadas ?? 0} mensagens novas`,
      });
      router.refresh();
    } catch (err) {
      setMensagem({ tipo: "erro", texto: err instanceof Error ? err.message : "Falha ao sincronizar" });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="relative inline-flex">
      <IconButton
        label="Sincronizar conversas"
        onClick={sincronizar}
        disabled={carregando}
        inverted
        className="!border-0 h-8 w-8"
      >
        <IconRefresh className={`h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`} />
      </IconButton>

      {mensagem && (
        <span
          className={`absolute top-full right-0 mt-1.5 whitespace-nowrap rounded-md bg-white px-2 py-1 text-xs shadow-md border border-border ${
            mensagem.tipo === "ok" ? "text-success" : "text-error"
          }`}
        >
          {mensagem.texto}
        </span>
      )}
    </div>
  );
}
