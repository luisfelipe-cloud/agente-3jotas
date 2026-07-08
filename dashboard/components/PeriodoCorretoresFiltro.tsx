"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export function PeriodoCorretoresFiltro() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const inicio = searchParams.get("inicio") ?? hojeISO();
  const fim = searchParams.get("fim") ?? hojeISO();
  const ehHoje = inicio === hojeISO() && fim === hojeISO();

  function atualizar(novoInicio: string, novoFim: string) {
    const params = new URLSearchParams({ inicio: novoInicio, fim: novoFim });
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-secondary">De</label>
        <input
          type="date"
          value={inicio}
          max={fim}
          onChange={(e) => atualizar(e.target.value, fim)}
          className="h-9 rounded-sm border border-border px-2 text-sm bg-white focus:outline-none focus:shadow-focus focus:border-navy-600"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-secondary">Até</label>
        <input
          type="date"
          value={fim}
          min={inicio}
          onChange={(e) => atualizar(inicio, e.target.value)}
          className="h-9 rounded-sm border border-border px-2 text-sm bg-white focus:outline-none focus:shadow-focus focus:border-navy-600"
        />
      </div>
      {!ehHoje && (
        <button
          onClick={() => atualizar(hojeISO(), hojeISO())}
          className="h-9 rounded-full px-4 text-xs font-medium bg-gray-50 text-text-secondary hover:text-navy-600"
        >
          Hoje
        </button>
      )}
    </div>
  );
}
