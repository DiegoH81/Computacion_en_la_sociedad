import { useState, type ReactNode } from 'react';
import { ConfirmCancelDialog } from './ConfirmCancelDialog';

interface FormDialogProps {
  title: string;
  onSave: () => void;
  onCancel: () => void;
  isLoading: boolean;
  errorMessage?: string | null;
  /** Aviso que debe seguir a la vista mientras se recorre el formulario. */
  notice?: ReactNode;
  children: ReactNode;
}

const HEADER_BUTTON = 'rounded-md px-4 py-1 text-xs font-bold uppercase text-white hover:opacity-90 disabled:opacity-50';

/** Ventana de los formularios de partidas: difumina el fondo y deja las acciones siempre a la vista. */
export function FormDialog({ title, onSave, onCancel, isLoading, errorMessage, notice, children }: FormDialogProps) {
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92vh] w-full max-w-5xl flex-col gap-3 rounded-2xl bg-app p-5 shadow-2xl"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black px-5 py-2">
          <h2 className="font-bold uppercase text-white">{title}</h2>
          <div className="flex gap-2">
            <button type="button" onClick={onSave} disabled={isLoading} className={`${HEADER_BUTTON} bg-solid-green`}>
              {isLoading ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button type="button" onClick={() => setIsConfirmingCancel(true)} disabled={isLoading} className={`${HEADER_BUTTON} bg-solid-red`}>
              Cancelar
            </button>
          </div>
        </header>

        {errorMessage && (
          <p role="alert" className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-solid-red">
            {errorMessage}
          </p>
        )}

        {notice}

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-2">{children}</div>
      </div>

      {isConfirmingCancel && (
        <ConfirmCancelDialog onConfirm={onCancel} onDismiss={() => setIsConfirmingCancel(false)} />
      )}
    </div>
  );
}
