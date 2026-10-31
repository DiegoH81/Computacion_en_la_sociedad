import { useState } from 'react';

interface SearchValues {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}

type SortField = 'nombre' | 'apellidoPaterno' | 'apellidoMaterno';
type SortDirection = 'asc' | 'desc';

interface PriestSearchFiltersProps {
  onSearch: (filters: SearchValues) => void;
  onClear: () => void;
  sortBy: SortField;
  sortDirection: SortDirection;
  onSortChange: (sortBy: SortField, direction: SortDirection) => void;
  isLoading: boolean;
}

export function PriestSearchFilters({
  onSearch,
  onClear,
  sortBy,
  sortDirection,
  onSortChange,
  isLoading,
}: PriestSearchFiltersProps) {
  const [nombre, setNombre] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');

  function handleSearch() {
    onSearch({ nombre, apellidoPaterno, apellidoMaterno });
  }

  function handleClear() {
    setNombre('');
    setApellidoPaterno('');
    setApellidoMaterno('');
    onClear();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Nombre</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
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
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:items-end">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSearch}
            disabled={isLoading}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Buscar
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={isLoading}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
          >
            Limpiar búsqueda
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span>Ordenar por:</span>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortField, sortDirection)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="nombre">Nombre</option>
            <option value="apellidoPaterno">Apellido paterno</option>
            <option value="apellidoMaterno">Apellido materno</option>
          </select>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={sortDirection === 'asc'}
              onChange={() => onSortChange(sortBy, 'asc')}
            />
            Ascendente
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={sortDirection === 'desc'}
              onChange={() => onSortChange(sortBy, 'desc')}
            />
            Descendente
          </label>
        </div>
      </div>
    </div>
  );
}
