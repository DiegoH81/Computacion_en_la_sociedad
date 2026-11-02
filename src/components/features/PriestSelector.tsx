import { useState } from 'react';
import { createPortal } from 'react-dom';
import { createPriest } from '../../controllers/PriestController';
import type { PriestFormValues } from '../../services/PriestService';
import { PriestFormModal } from './PriestFormModal';

interface PriestOption {
  id: number;
  nombreCompleto: string;
  parroquiaNombre: string;
}

interface PriestSelectorProps {
  value: number | null;
  onSelect: (priestId: number) => void;
  onSearch: (query: string) => void;
  options: PriestOption[];
  isLoading: boolean;
  /** Parroquia de la partida que se edita. Por defecto, la activa. */
  parroquiaId?: number;
}

export function PriestSelector({
  value,
  onSelect,
  onSearch,
  options,
  isLoading,
  parroquiaId,
}: PriestSelectorProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const selectedOption = options.find((option) => option.id === value);

  function handleQueryChange(newQuery: string) {
    setQuery(newQuery);
    setIsOpen(true);
    onSearch(newQuery);
  }

  function handleSelect(option: PriestOption) {
    onSelect(option.id);
    setQuery(option.nombreCompleto);
    setIsOpen(false);
  }

  async function handleCreate(values: PriestFormValues) {
    setIsSaving(true);
    setCreateError(null);
    const result = await createPriest(values, parroquiaId);
    setIsSaving(false);

    if (result.id === undefined) {
      setCreateError(result.errorMessage ?? 'Error al crear el ministro.');
      return;
    }

    onSelect(result.id);
    setQuery([values.nombre, values.apellidoPaterno, values.apellidoMaterno].map((name) => name.trim()).join(' '));
    setIsOpen(false);
    setIsCreating(false);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={isOpen ? query : (selectedOption?.nombreCompleto ?? query)}
        onChange={(e) => handleQueryChange(e.target.value)}
        onFocus={() => {
          setIsOpen(true);
          onSearch(query);
        }}
        placeholder="Buscar celebrante..."
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-600"
      />

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="max-h-48 overflow-y-auto">
            {isLoading && <p className="px-3 py-2 text-sm text-slate-500">Buscando...</p>}

            {!isLoading && options.length === 0 && (
              <p className="px-3 py-2 text-sm text-slate-500">Sin resultados.</p>
            )}

            {!isLoading &&
              options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-800">{option.nombreCompleto}</span>
                  <span className="text-xs text-slate-500">{option.parroquiaNombre}</span>
                </button>
              ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setIsCreating(true);
            }}
            className="w-full border-t border-slate-200 px-3 py-2 text-left text-sm font-semibold text-solid-blue hover:bg-slate-50"
          >
            + Crear celebrante
          </button>
        </div>
      )}

      {/* El selector suele estar dentro de un <label>: fuera de él, un clic en el formulario no vuelve a este campo. */}
      {isCreating &&
        createPortal(
          <PriestFormModal
            mode="create"
            initialValues={{ titulo: '', nombre: query.trim(), apellidoPaterno: '', apellidoMaterno: '' }}
            errorMessage={createError}
            onSave={handleCreate}
            onCancel={() => setIsCreating(false)}
            isLoading={isSaving}
          />,
          document.body,
        )}
    </div>
  );
}
