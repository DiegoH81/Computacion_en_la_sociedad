import { useState, type FormEvent } from 'react';

interface AnnulmentModalProps {
  onConfirm: (motivo: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function AnnulmentModal({ onConfirm, onCancel, isLoading }: AnnulmentModalProps) {
  const [motivo, setMotivo] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onConfirm(motivo);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-2 text-lg font-semibold text-slate-800">Anular documento</h2>
        <p className="mb-4 text-sm text-slate-600">
          Esta acción marcará el documento como anulado. No se elimina, pero dejará de
          considerarse vigente.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Motivo de anulación
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              required
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
            />
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="rounded-md bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
            >
              {isLoading ? 'Anulando...' : 'Confirmar anulación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
