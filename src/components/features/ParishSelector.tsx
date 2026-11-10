import { useState } from 'react';

interface Parish {
  id: number;
  nombre: string;
}

interface ParishSelectorProps {
  parishes: Parish[];
  currentParishId: number | null;
  /** Las parroquias donde trabaja el usuario: se muestran primero y resaltadas. Las demás solo se consultan. */
  ownParishIds?: number[];
  onSelect: (parishId: number) => void;
  isLoading: boolean;
}

export function ParishSelector({
  parishes,
  currentParishId,
  ownParishIds = [],
  onSelect,
  isLoading,
}: ParishSelectorProps) {
  const [selectedId, setSelectedId] = useState<number | null>(currentParishId);

  const ownParishes = ownParishIds
    .map((id) => parishes.find((parish) => parish.id === id))
    .filter((parish): parish is Parish => parish !== undefined);
  const otherParishes = parishes.filter((parish) => !ownParishIds.includes(parish.id));
  const ownLabel = ownParishes.length > 1 ? '(trabajo aquí)' : '(mi parroquia)';

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
        {ownParishes.map((parish) => (
          <option key={parish.id} value={parish.id} className="bg-emerald-100 font-semibold text-emerald-900">
            ★ {parish.nombre} {ownLabel}
          </option>
        ))}
        {otherParishes.map((parish) => (
          <option key={parish.id} value={parish.id}>
            {parish.nombre}
          </option>
        ))}
      </select>

      {ownParishes.map((parish) => (
        <button
          key={parish.id}
          type="button"
          onClick={() => setSelectedId(parish.id)}
          disabled={isLoading || selectedId === parish.id}
          className="w-fit text-left text-xs font-medium text-emerald-800 hover:underline disabled:no-underline disabled:opacity-70"
        >
          ★ {ownParishes.length > 1 ? 'Trabajar en' : 'Mi parroquia'}: {parish.nombre}
        </button>
      ))}

      {ownParishes.length > 0 && (
        <p className="text-xs text-slate-600">En las parroquias sin ★ solo puede consultar.</p>
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