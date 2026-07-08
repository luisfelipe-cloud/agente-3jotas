"use client";

import { useState } from "react";
import type { ParametroCriterio, PlaybookScript } from "@/lib/types";
import { ParametrosForm } from "@/components/ParametrosForm";
import { PlaybooksForm } from "@/components/PlaybooksForm";

const SUBABAS = [
  { id: "criterios", label: "Critérios" },
  { id: "playbooks", label: "Playbooks" },
] as const;

export function ConfiguracoesTabs({
  parametrosIniciais,
  playbooksIniciais,
}: {
  parametrosIniciais: ParametroCriterio[];
  playbooksIniciais: PlaybookScript[];
}) {
  const [aba, setAba] = useState<(typeof SUBABAS)[number]["id"]>("criterios");

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-full bg-gray-50 p-1">
        {SUBABAS.map((s) => (
          <button
            key={s.id}
            onClick={() => setAba(s.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              aba === s.id ? "bg-coral-600 text-white shadow-sm" : "text-text-secondary hover:text-coral-600"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {aba === "criterios" ? (
        <ParametrosForm parametrosIniciais={parametrosIniciais} />
      ) : (
        <PlaybooksForm playbooksIniciais={playbooksIniciais} />
      )}
    </div>
  );
}
