import { useState } from 'react';

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

  return (
    <div className="relative">
      <input
        type="text"
        value={isOpen ? query : (selectedOption?.nombreCompleto ?? query)}
        onChange={(e) => handleQueryChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        placeholder="Buscar celebrante..."
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-600"
      />

      {isOpen && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
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
      )}
    </div>
  );
}
