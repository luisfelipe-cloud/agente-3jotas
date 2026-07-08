"use client";

import { useEffect } from "react";

export interface ToastMensagem {
  tipo: "ok" | "erro";
  texto: string;
}

export function Toast({ mensagem, onDone }: { mensagem: ToastMensagem; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [mensagem, onDone]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 rounded-md px-4 py-2.5 text-sm font-medium shadow-lg ${
        mensagem.tipo === "ok" ? "bg-success text-white" : "bg-error text-white"
      }`}
    >
      {mensagem.texto}
    </div>
  );
}
