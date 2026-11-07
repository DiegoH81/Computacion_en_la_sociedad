import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Minister } from '../../../shared/models';
import { createPriest, ministerName } from '../../controllers/PriestController';
import { emptyMinister } from '../../lib/emptyRecords';
import { PriestFormModal } from './PriestFormModal';

interface PriestSelectorProps {
  value: number | null;
  onSelect: (priestId: number) => void;
  onSearch: (query: string) => void;
  options: Minister[];
  isLoading: boolean;
}

export function PriestSelector({
  value,
  onSelect,
  onSearch,
  options,
  isLoading,
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

  function handleSelect(option: Minister) {
    onSelect(option.id as number);
    setQuery(ministerName(option));
    setIsOpen(false);
  }

  async function handleCreate(values: Minister) {
    setIsSaving(true);
    setCreateError(null);
    const result = await createPriest(values);
    setIsSaving(false);

    if (result.id === undefined) {
      setCreateError(result.errorMessage ?? 'Error al crear el ministro.');
      return;
    }

    onSelect(result.id);
    setQuery(ministerName({ ...values, nombre: values.nombre.trim(), apellido_paterno: values.apellido_paterno.trim(), apellido_materno: values.apellido_materno.trim() }));
    setIsOpen(false);
    setIsCreating(false);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={isOpen ? query : (selectedOption ? ministerName(selectedOption) : query)}
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
                  <span className="font-medium text-slate-800">{ministerName(option)}</span>
                  <span className="text-xs text-slate-500">{option.parroquia?.nombre}</span>
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
            initialValues={{ ...emptyMinister(), nombre: query.trim() }}
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
