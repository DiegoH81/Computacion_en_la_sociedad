import { useState } from 'react';

interface Parish {
  id: number;
  nombre: string;
}

interface ParishSelectorProps {
  parishes: Parish[];
  currentParishId: number | null;
  ownParishId?: number | null; // parroquia del usuario: se muestra primero y resaltada
  onSelect: (parishId: number) => void;
  isLoading: boolean;
}

export function ParishSelector({
  parishes,
  currentParishId,
  ownParishId = null,
  onSelect,
  isLoading,
}: ParishSelectorProps) {
  const [selectedId, setSelectedId] = useState<number | null>(currentParishId);

  const ownParish = parishes.find((parish) => parish.id === ownParishId) ?? null;
  const otherParishes = parishes.filter((parish) => parish.id !== ownParishId);

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
        {ownParish && (
          <option value={ownParish.id} className="bg-emerald-100 font-semibold text-emerald-900">
            ★ {ownParish.nombre} (mi parroquia)
          </option>
        )}
        {otherParishes.map((parish) => (
          <option key={parish.id} value={parish.id}>
            {parish.nombre}
          </option>
        ))}
      </select>

      {ownParish && (
        <button
          type="button"
          onClick={() => setSelectedId(ownParish.id)}
          disabled={isLoading || selectedId === ownParish.id}
          className="w-fit text-left text-xs font-medium text-emerald-800 hover:underline disabled:no-underline disabled:opacity-70"
        >
          ★ Mi parroquia: {ownParish.nombre}
        </button>
      )}

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