"use client";

import { Modal } from "@/components/ui/Modal";
import { IconButton } from "@/components/ui/IconButton";
import { IconClose, IconTrash } from "@/components/ui/icons";

export function ConfirmModal({
  titulo,
  mensagem,
  confirmando = false,
  onConfirmar,
  onCancelar,
}: {
  titulo: string;
  mensagem: string;
  confirmando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <Modal open onClose={onCancelar} title={titulo}>
      <div className="space-y-5">
        <p className="text-sm text-text-secondary leading-relaxed">{mensagem}</p>
        <div className="flex items-center justify-end gap-3">
          <IconButton label="Cancelar" onClick={onCancelar} disabled={confirmando} inverted>
            <IconClose />
          </IconButton>
          <IconButton label="Confirmar exclusão" onClick={onConfirmar} disabled={confirmando}>
            <IconTrash />
          </IconButton>
        </div>
      </div>
    </Modal>
  );
}
