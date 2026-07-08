"use client";

import Link from "next/link";
import type { PontoAtencao } from "@/lib/types";
import { CRITERIO_LABEL } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ExpandableList } from "@/components/ExpandableList";

export function PontosAtencaoCard({ pontosAtencao }: { pontosAtencao: PontoAtencao[] }) {
  return (
    <Card className="flex flex-col">
      <p className="text-sm font-semibold text-navy-900 mb-4">Pontos de atenção</p>
      <ExpandableList
        items={pontosAtencao}
        keyFor={(p) => `${p.conversaId}-${p.criterio}`}
        limit={3}
        emptyLabel="Nenhum ponto de atenção nas últimas 48h."
        renderItem={(p) => (
          <div className="flex items-start justify-between gap-3 text-sm border-b border-border pb-3">
            <div>
              <Link href={`/corretores/${p.corretorId}`} className="font-medium text-navy-600 hover:underline">
                {p.corretorNome}
              </Link>
              <p className="text-text-secondary">{p.descricao}</p>
            </div>
            <Badge variant="error">{CRITERIO_LABEL[p.criterio]}</Badge>
          </div>
        )}
      />
    </Card>
  );
}
