"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/Card";

export function ErrorState({ error, onTentarNovamente }: { error: Error & { digest?: string }; onTentarNovamente: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card variant="border" className="max-w-lg mx-auto text-center space-y-3 py-10">
      <p className="text-sm font-semibold text-error">Não foi possível carregar esta página.</p>
      <p className="text-xs text-text-secondary">{error.message || "Erro inesperado. Tente novamente."}</p>
      <button
        onClick={onTentarNovamente}
        className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-coral-600 text-white text-sm font-medium hover:bg-coral-700 transition-colors"
      >
        Recarregar
      </button>
    </Card>
  );
}
