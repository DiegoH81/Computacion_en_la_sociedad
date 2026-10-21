import { useState } from 'react';

interface Parish {
  id: number;
  nombre: string;
}

interface ParishSelectorProps {
  parishes: Parish[];
  currentParishId: number | null;
  onSelect: (parishId: number) => void;
  isLoading: boolean;
}

export function ParishSelector({
  parishes,
  currentParishId,
  onSelect,
  isLoading,
}: ParishSelectorProps) {
  const [selectedId, setSelectedId] = useState<number | null>(currentParishId);

  function handleConfirm() {
    if (selectedId !== null) {
      onSelect(selectedId);
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700">
        Seleccionar Parroquia
      </h2>

      <select
        value={selectedId ?? ''}
        onChange={(e) => setSelectedId(Number(e.target.value))}
        disabled={isLoading}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-600"
      >
        <option value="" disabled>
          Parroquias disponibles
        </option>
        {parishes.map((parish) => (
          <option key={parish.id} value={parish.id}>
            {parish.nombre}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={handleConfirm}
        disabled={selectedId === null || isLoading}
        className="rounded-md bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {isLoading ? 'Cargando...' : 'Confirmar'}
      </button>
    </div>
  );
}