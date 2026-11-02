interface ConfirmCancelDialogProps {
  onConfirm: () => void;
  onDismiss: () => void;
}

/** Pide confirmar antes de cerrar un formulario, porque lo escrito se pierde. */
export function ConfirmCancelDialog({ onConfirm, onDismiss }: ConfirmCancelDialogProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-cancel-title"
        aria-describedby="confirm-cancel-description"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h2 id="confirm-cancel-title" className="font-bold text-slate-900">
          ¿Está seguro de cancelar los cambios?
        </h2>
        <p id="confirm-cancel-description" className="mt-2 text-sm text-slate-700">
          Se perderá lo que haya escrito en este formulario.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          {/* Con el foco aquí, un Enter de más no descarta el formulario. */}
          <button
            type="button"
            autoFocus
            onClick={onDismiss}
            className="rounded-md bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-300"
          >
            Seguir editando
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-solid-red px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Sí, cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
