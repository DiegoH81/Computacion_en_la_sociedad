import { useId, useState, type FormEvent, type ReactNode } from 'react';
import type { NameColumn, SearchFilters } from '../../../shared/models';

// Piezas de las pantallas de búsqueda (partidas, ministros, usuarios): todas se ven iguales.

export type SortDirection = 'asc' | 'desc';
export type SearchValues = Required<Pick<SearchFilters, NameColumn>>;

const SEARCH_BUTTON = 'rounded-lg px-6 py-2 text-base font-bold text-white uppercase hover:opacity-90 disabled:opacity-50';
const INPUT = 'w-full rounded-lg bg-white px-3 py-2 text-base text-black outline-none focus:ring-2 focus:ring-darker-app';

const CHEVRON_PATHS = {
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  up: 'M5 15l7-7 7 7',
  down: 'M5 9l7 7 7-7',
};

/** Flecha en ángulo, del tamaño de la letra que la rodea. */
function Chevron({ direction }: { direction: keyof typeof CHEVRON_PATHS }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-[1em] w-[1em] shrink-0"
    >
      <path d={CHEVRON_PATHS[direction]} />
    </svg>
  );
}

export function PanelTitle({ children }: { children: string }) {
  return <h1 className="rounded-xl bg-black px-4 py-2 text-xl font-bold text-white uppercase">{children}</h1>;
}

export function PanelError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <p role="alert" className="col-start-1 rounded-lg bg-red-50 px-4 py-2 text-sm text-solid-red">
      {message}
    </p>
  );
}

/** Lista "Parroquia" para filtrar una tabla. null es "Todas las parroquias". */
export function ParishFilter({
  parishes,
  value,
  onChange,
}: {
  parishes: { id: number; nombre: string }[];
  value: number | null;
  onChange: (parishId: number | null) => void;
}) {
  const fieldId = useId();

  return (
    <div className="w-72">
      <label htmlFor={fieldId} className="mb-1 block text-sm font-bold text-black uppercase">
        Parroquia
      </label>
      <select
        id={fieldId}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
        className={INPUT}
      >
        <option value="">Todas las parroquias</option>
        {parishes.map((parish) => (
          <option key={parish.id} value={parish.id}>
            {parish.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Bloque claro con los tres campos de nombre y los botones Buscar y Limpiar búsqueda. */
export function NameSearchForm({
  firstLabel,
  isLoading,
  onSearch,
  onClear,
  extraFilter,
}: {
  firstLabel: string;
  isLoading: boolean;
  onSearch: (filters: SearchValues) => void;
  onClear: () => void;
  /** Otro filtro, como ParishFilter, a la izquierda de los botones. */
  extraFilter?: ReactNode;
}) {
  const fieldId = useId();
  const [filters, setFilters] = useState<SearchValues>({ nombres: '', apellido_paterno: '', apellido_materno: '' });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSearch(filters);
  }

  function handleClear() {
    setFilters({ nombres: '', apellido_paterno: '', apellido_materno: '' });
    onClear();
  }

  const filterFields: { key: keyof SearchValues; label: string }[] = [
    { key: 'nombres', label: firstLabel },
    { key: 'apellido_paterno', label: 'Apellido paterno' },
    { key: 'apellido_materno', label: 'Apellido materno' },
  ];

  return (
    <form onSubmit={handleSubmit} className="col-start-1 rounded-2xl bg-lighter-green p-4">
      <div className="grid grid-cols-3 gap-4">
        {filterFields.map(({ key, label }) => (
          <div key={key}>
            <label htmlFor={`${fieldId}-${key}`} className="mb-1 block text-sm font-bold text-black uppercase">
              {label}
            </label>
            <input
              id={`${fieldId}-${key}`}
              type="text"
              value={filters[key]}
              onChange={(event) => setFilters({ ...filters, [key]: event.target.value })}
              className={INPUT}
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-end justify-end gap-2">
        {extraFilter && <div className="mr-auto">{extraFilter}</div>}
        <button type="submit" disabled={isLoading} className={`${SEARCH_BUTTON} bg-solid-blue`}>
          Buscar
        </button>
        <button type="button" onClick={handleClear} disabled={isLoading} className={`${SEARCH_BUTTON} bg-solid-red`}>
          Limpiar búsqueda
        </button>
      </div>
    </form>
  );
}

/** Bloque oscuro de la derecha: columna de orden y dirección. */
export function SortPanel({
  sortBy,
  sortDirection,
  onSortChange,
}: {
  sortBy: NameColumn;
  sortDirection: SortDirection;
  onSortChange: (sortBy: NameColumn, direction: SortDirection) => void;
}) {
  const fieldId = useId();

  return (
    <div className="col-start-2 self-start rounded-2xl bg-dark-app p-4 text-white">
      <label htmlFor={`${fieldId}-sort`} className="mb-2 block font-bold uppercase">
        Ordenar por:
      </label>
      <select
        id={`${fieldId}-sort`}
        value={sortBy}
        onChange={(event) => onSortChange(event.target.value as NameColumn, sortDirection)}
        className={INPUT}
      >
        <option value="nombres">Nombre</option>
        <option value="apellido_paterno">Apellido paterno</option>
        <option value="apellido_materno">Apellido materno</option>
      </select>

      <div className="mt-3 flex flex-col gap-1">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name={`${fieldId}-direction`}
            checked={sortDirection === 'asc'}
            onChange={() => onSortChange(sortBy, 'asc')}
            className="h-5 w-5"
          />
          <Chevron direction="up" />
          Ascendente
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name={`${fieldId}-direction`}
            checked={sortDirection === 'desc'}
            onChange={() => onSortChange(sortBy, 'desc')}
            className="h-5 w-5"
          />
          <Chevron direction="down" />
          Descendente
        </label>
      </div>
    </div>
  );
}

function getPageItems(currentPage: number, totalPages: number): (number | 'gap')[] {
  const candidates = [1, 2, 3, currentPage - 1, currentPage, currentPage + 1, totalPages - 1, totalPages];
  const pages = [...new Set(candidates)]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  return pages.flatMap((page, index) =>
    index > 0 && page - pages[index - 1] > 1 ? (['gap', page] as const) : ([page] as const),
  );
}

const PAGE_STEP_BUTTON =
  'flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-white/15 disabled:opacity-50 disabled:hover:bg-transparent';

/** Paginación blanca, debajo de la tabla verde. */
export function PageNav({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav aria-label="Paginación" className="flex items-center justify-center gap-3 text-white">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className={PAGE_STEP_BUTTON}
      >
        <Chevron direction="left" />
        Anterior
      </button>
      {getPageItems(currentPage, totalPages).map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-current={item === currentPage ? 'page' : undefined}
            className={`min-w-9 rounded-lg px-2 py-1 ${item === currentPage ? 'bg-white font-bold text-black' : 'hover:underline'}`}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className={PAGE_STEP_BUTTON}
      >
        Siguiente
        <Chevron direction="right" />
      </button>
    </nav>
  );
}
