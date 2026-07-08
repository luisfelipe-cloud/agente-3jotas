"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { IconChevronDown } from "@/components/ui/icons";

export function ExpandableList<T>({
  items,
  renderItem,
  keyFor,
  limit = 4,
  emptyLabel = "Nada por aqui.",
}: {
  items: T[];
  renderItem: (item: T) => ReactNode;
  keyFor: (item: T) => string;
  limit?: number;
  emptyLabel?: string;
}) {
  const [expandido, setExpandido] = useState(false);
  const visiveis = expandido ? items : items.slice(0, limit);

  return (
    <div className="flex flex-col flex-1">
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3 flex-1">
          {visiveis.map((item) => (
            <li key={keyFor(item)}>{renderItem(item)}</li>
          ))}
        </ul>
      )}

      {items.length > limit && (
        <IconButton
          label={expandido ? "Ver menos" : "Ver mais"}
          className="mt-4 self-start h-8 w-8"
          onClick={() => setExpandido((v) => !v)}
        >
          <IconChevronDown className={`h-4 w-4 transition-transform ${expandido ? "rotate-180" : ""}`} />
        </IconButton>
      )}
    </div>
  );
}
