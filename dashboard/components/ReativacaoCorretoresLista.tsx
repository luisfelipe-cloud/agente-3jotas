"use client";

import Link from "next/link";

function iniciais(nome: string) {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
}

export interface CorretorReativacaoResumo {
  id: string;
  nomeCrm: string;
  ativo: boolean;
  totalLeads: number;
}

// Mesmo visual dos cards de CorretoresManager (avatar com iniciais + nome),
// sem as barras de nota/ranking — aqui é só um seletor de corretor: clicar
// leva pra lista de leads dele (fluxo corretor > lista).
export function ReativacaoCorretoresLista({ corretores }: { corretores: CorretorReativacaoResumo[] }) {
  const ordenados = [...corretores].sort((a, b) => a.nomeCrm.localeCompare(b.nomeCrm));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
      {ordenados.map((c) => (
        <Link
          key={c.id}
          href={`/reativacao-base/${c.id}`}
          className="rounded-lg bg-surface p-5 sm:p-6 border border-transparent shadow-sm hover:shadow-lg transition-all flex items-center gap-3"
        >
          <div className="h-11 w-11 shrink-0 rounded-full bg-navy-600 text-white font-semibold flex items-center justify-center text-sm">
            {iniciais(c.nomeCrm)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-text-primary leading-tight truncate">{c.nomeCrm}</p>
            <p className="text-xs text-text-secondary mt-0.5">
              {c.totalLeads} lead{c.totalLeads === 1 ? "" : "s"} na reativação {!c.ativo && "· inativo"}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
