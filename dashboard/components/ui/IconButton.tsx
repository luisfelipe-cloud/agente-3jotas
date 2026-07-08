import type { ButtonHTMLAttributes, ReactNode } from "react";

// Botão só de ícone, sempre no coral da marca — usado no lugar de botões com
// texto (Salvar/Cancelar/Excluir/+ Novo/...) em toda a aplicação. `label` vira
// title + aria-label, então a ação continua acessível sem depender do ícone.
// `inverted` troca pra fundo branco com ícone/borda coral (mesma paleta, cores
// invertidas) — usado onde o botão sólido pesa demais visualmente.
export function IconButton({
  label,
  children,
  className = "",
  inverted = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode; inverted?: boolean }) {
  const cores = inverted
    ? "bg-white text-coral-600 border border-coral-600 hover:bg-coral-50"
    : "bg-coral-600 text-white hover:bg-coral-700 active:bg-coral-700/90";

  return (
    <button
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center h-9 w-9 shrink-0 rounded-md transition-colors focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-40 disabled:cursor-not-allowed ${cores} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
