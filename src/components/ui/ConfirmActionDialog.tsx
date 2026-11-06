interface ConfirmActionDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
}

/** Pide confirmar una acción que cuesta deshacer. */
export function ConfirmActionDialog({ title, description, confirmLabel, onConfirm, onDismiss }: ConfirmActionDialogProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-action-title"
        aria-describedby="confirm-action-description"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h2 id="confirm-action-title" className="font-bold text-slate-900">
          {title}
        </h2>
        <p id="confirm-action-description" className="mt-2 text-sm text-slate-700">
          {description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          {/* Con el foco aquí, un Enter de más no confirma. */}
          <button
            type="button"
            autoFocus
            onClick={onDismiss}
            className="rounded-md bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-300"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-solid-red px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
