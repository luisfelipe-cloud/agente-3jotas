"use client";

import { useEffect, useRef, useState } from "react";
import { IconMoreVertical } from "@/components/ui/icons";

interface KebabMenuItem {
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}

// Menu discreto "⋮" — usado no lugar de vários ícones de ação lado a lado,
// que ficavam competindo visualmente com o conteúdo do card.
export function KebabMenu({ items }: { items: KebabMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Mais ações"
        aria-label="Mais ações"
        className="h-7 w-7 rounded-md flex items-center justify-center text-text-secondary hover:bg-navy-50 hover:text-navy-600 transition-colors"
      >
        <IconMoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-md bg-white shadow-lg border border-border py-1">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-navy-50 transition-colors ${
                item.tone === "danger" ? "text-error" : "text-text-primary"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
