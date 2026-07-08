"use client";

import Link from "next/link";
import type { CorretorComErros } from "@/lib/types";
import { CRITERIO_LABEL } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ExpandableList } from "@/components/ExpandableList";

export function CorretoresComErrosCard({ corretoresComMaisErros }: { corretoresComMaisErros: CorretorComErros[] }) {
  return (
    <Card className="flex flex-col">
      <p className="text-sm font-semibold text-navy-900 mb-4">Corretores com mais erros</p>
      <ExpandableList
        items={corretoresComMaisErros}
        keyFor={(c) => c.corretorId}
        emptyLabel="Nenhum corretor com erros no período."
        renderItem={(c) => (
          <div className="flex items-center justify-between text-sm border-b border-border pb-3">
            <div>
              <Link href={`/corretores/${c.corretorId}`} className="font-medium text-navy-600 hover:underline">
                {c.corretorNome}
              </Link>
              <p className="text-text-secondary">Ponto fraco: {CRITERIO_LABEL[c.criterioMaisFraco]}</p>
            </div>
            <Badge variant="warning">{c.totalErros} erros</Badge>
          </div>
        )}
      />
    </Card>
  );
}
