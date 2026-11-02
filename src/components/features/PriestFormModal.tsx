import { useState, type FormEvent } from 'react';
import { ConfirmCancelDialog } from '../ui/ConfirmCancelDialog';

interface PriestFormValues {
  titulo: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}

interface PriestFormModalProps {
  mode: 'create' | 'edit';
  initialValues?: PriestFormValues;
  onSave: (values: PriestFormValues) => void;
  onCancel: () => void;
  isLoading: boolean;
  errorMessage?: string | null;
}

export function PriestFormModal({
  mode,
  initialValues,
  onSave,
  onCancel,
  isLoading,
  errorMessage,
}: PriestFormModalProps) {
  const [titulo, setTitulo] = useState(initialValues?.titulo ?? '');
  const [nombre, setNombre] = useState(initialValues?.nombre ?? '');
  const [apellidoPaterno, setApellidoPaterno] = useState(
    initialValues?.apellidoPaterno ?? '',
  );
  const [apellidoMaterno, setApellidoMaterno] = useState(
    initialValues?.apellidoMaterno ?? '',
  );

  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ titulo, nombre, apellidoPaterno, apellidoMaterno });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">
          {mode === 'create' ? 'Añadir nuevo ministro' : 'Editar ministro'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Título</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Apellido paterno
            </label>
            <input
              type="text"
              value={apellidoPaterno}
              onChange={(e) => setApellidoPaterno(e.target.value)}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Apellido materno
            </label>
            <input
              type="text"
              value={apellidoMaterno}
              onChange={(e) => setApellidoMaterno(e.target.value)}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
            />
          </div>

          {errorMessage && (
            <p role="alert" className="text-sm font-medium text-solid-red">
              {errorMessage}
            </p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsConfirmingCancel(true)}
              disabled={isLoading}
              className="rounded-md bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {isLoading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>

      {isConfirmingCancel && (
        <ConfirmCancelDialog onConfirm={onCancel} onDismiss={() => setIsConfirmingCancel(false)} />
      )}
    </div>
  );
}
