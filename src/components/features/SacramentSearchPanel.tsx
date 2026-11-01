import { useId, useState, type FormEvent, type ReactNode } from 'react';

export interface SacramentRowBase {
  id: number;
  parroquiaId: number;
  parroquiaNombre: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
  estado: 'vigente' | 'anulado';
}

export interface SacramentColumn<T> {
  header: string;
  render: (row: T) => ReactNode;
}

export type SortField = 'nombre' | 'apellidoPaterno' | 'apellidoMaterno';
export type SortDirection = 'asc' | 'desc';

interface SearchValues {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}

interface SacramentSearchPanelProps<T extends SacramentRowBase> {
  title: string;
  errorMessage: string | null;
  rows: T[];
  columns: SacramentColumn<T>[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  sortBy: SortField;
  sortDirection: SortDirection;
  onSortChange: (sortBy: SortField, direction: SortDirection) => void;
  onSearch: (filters: SearchValues) => void;
  onClear: () => void;
  /** Falso cuando se consulta una parroquia ajena: solo se puede buscar y ver. */
  canWrite: boolean;
  canManage: (parroquiaId: number) => boolean;
  onAdd: () => void;
  onEdit: (id: number) => void;
  onPrint: (id: number) => void;
  onAnnul: (id: number) => void;
  onPrintIndex: () => void;
}

const ACTION_BUTTON =
  'w-full rounded-lg px-3 py-2 text-base font-bold text-white uppercase hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
const SEARCH_BUTTON =
  'rounded-lg px-6 py-2 text-base font-bold text-white uppercase hover:opacity-90 disabled:opacity-50';
const INPUT = 'w-full rounded-lg bg-white px-3 py-2 text-base text-black outline-none focus:ring-2 focus:ring-darker-app';
const CELL = 'border border-slate-400 bg-white px-2 py-1 text-sm font-bold text-black uppercase';

function getPageItems(currentPage: number, totalPages: number): (number | 'gap')[] {
  const candidates = [1, 2, 3, currentPage - 1, currentPage, currentPage + 1, totalPages - 1, totalPages];
  const pages = [...new Set(candidates)]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  return pages.flatMap((page, index) =>
    index > 0 && page - pages[index - 1] > 1 ? (['gap', page] as const) : ([page] as const),
  );
}

export function SacramentSearchPanel<T extends SacramentRowBase>({
  title,
  errorMessage,
  rows,
  columns,
  isLoading,
  currentPage,
  totalPages,
  onPageChange,
  sortBy,
  sortDirection,
  onSortChange,
  onSearch,
  onClear,
  canWrite,
  canManage,
  onAdd,
  onEdit,
  onPrint,
  onAnnul,
  onPrintIndex,
}: SacramentSearchPanelProps<T>) {
  const fieldId = useId();
  const [filters, setFilters] = useState<SearchValues>({
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selectedRow = rows.find((row) => row.id === selectedId) ?? null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSearch(filters);
  }

  function handleClear() {
    setFilters({ nombre: '', apellidoPaterno: '', apellidoMaterno: '' });
    onClear();
  }

  const filterFields: { key: keyof SearchValues; label: string }[] = [
    { key: 'nombre', label: 'Nombres completos' },
    { key: 'apellidoPaterno', label: 'Apellido paterno' },
    { key: 'apellidoMaterno', label: 'Apellido materno' },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_14rem] gap-4">
      <h1 className="rounded-xl bg-black px-4 py-2 text-xl font-bold text-white uppercase">{title}</h1>

      {errorMessage && (
        <p role="alert" className="col-start-1 rounded-lg bg-red-50 px-4 py-2 text-sm text-solid-red">
          {errorMessage}
        </p>
      )}

      <form onSubmit={handleSubmit} className="col-start-1 rounded-2xl bg-lighter-green p-4">
        <div className="grid grid-cols-3 gap-4">
          {filterFields.map(({ key, label }) => (
            <div key={key}>
              <label
                htmlFor={`${fieldId}-${key}`}
                className="mb-1 block text-sm font-bold text-black uppercase"
              >
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

        <div className="mt-3 flex justify-end gap-2">
          <button type="submit" disabled={isLoading} className={`${SEARCH_BUTTON} bg-solid-blue`}>
            Buscar
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={isLoading}
            className={`${SEARCH_BUTTON} bg-solid-red`}
          >
            Limpiar búsqueda
          </button>
        </div>
      </form>

      <div className="col-start-2 self-start rounded-2xl bg-dark-app p-4 text-white">
        <label htmlFor={`${fieldId}-sort`} className="mb-2 block font-bold uppercase">
          Ordenar por:
        </label>
        <select
          id={`${fieldId}-sort`}
          value={sortBy}
          onChange={(event) => onSortChange(event.target.value as SortField, sortDirection)}
          className={INPUT}
        >
          <option value="nombre">Nombre</option>
          <option value="apellidoPaterno">Apellido paterno</option>
          <option value="apellidoMaterno">Apellido materno</option>
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
            ∧ Ascendente
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={`${fieldId}-direction`}
              checked={sortDirection === 'desc'}
              onChange={() => onSortChange(sortBy, 'desc')}
              className="h-5 w-5"
            />
            ∨ Descendente
          </label>
        </div>
      </div>

      <div className="col-start-1 flex flex-col gap-3 rounded-2xl bg-table-panel p-4">
        <div className="h-72 overflow-auto rounded bg-table-body">
          {isLoading || rows.length === 0 ? (
            <p className="p-4 text-slate-700">
              {isLoading ? 'Cargando...' : 'No se encontraron partidas.'}
            </p>
          ) : (
            <table className="w-full border-separate border-spacing-0 text-left">
              <thead className="sticky top-0 z-10 bg-table-panel text-sm font-medium text-white">
                <tr>
                  <th className="px-2 pb-2 font-medium">Parroquia</th>
                  <th className="px-2 pb-2 font-medium">Libro</th>
                  <th className="px-2 pb-2 font-medium">Folio</th>
                  <th className="px-2 pb-2 font-medium">Registro</th>
                  {columns.map((column) => (
                    <th key={column.header} className="px-2 pb-2 font-medium">
                      {column.header}
                    </th>
                  ))}
                  {canWrite && <th aria-label="Seleccionar" className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const selectable = canWrite && canManage(row.parroquiaId);
                  const isSelected = selectedRow?.id === row.id;

                  return (
                    <tr
                      key={row.id}
                      onClick={
                        selectable ? () => setSelectedId(isSelected ? null : row.id) : undefined
                      }
                      className={selectable ? 'cursor-pointer' : undefined}
                    >
                      <td className={CELL}>{row.parroquiaNombre}</td>
                      <td className={CELL}>{row.numeroLibro}</td>
                      <td className={CELL}>{row.numeroFolio}</td>
                      <td className={CELL}>{row.numeroRegistro}</td>
                      {columns.map((column, index) => (
                        <td key={column.header} className={CELL}>
                          {column.render(row)}
                          {index === 0 && row.estado === 'anulado' && (
                            <span className="ml-2 rounded bg-solid-red px-1 text-xs text-white">
                              Anulado
                            </span>
                          )}
                        </td>
                      ))}
                      {canWrite && (
                        <td className="px-2 py-1 text-center">
                          {selectable && (
                            <input
                              type="checkbox"
                              readOnly
                              checked={isSelected}
                              aria-label={`Seleccionar partida ${row.numeroRegistro}`}
                              className="h-5 w-5 cursor-pointer"
                            />
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <nav aria-label="Paginación" className="flex items-center justify-center gap-3 text-white">
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-2 py-1 hover:underline disabled:opacity-50 disabled:hover:no-underline"
          >
            ← Anterior
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
                className={`min-w-9 rounded-lg px-2 py-1 ${
                  item === currentPage ? 'bg-white font-bold text-black' : 'hover:underline'
                }`}
              >
                {item}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-2 py-1 hover:underline disabled:opacity-50 disabled:hover:no-underline"
          >
            Siguiente →
          </button>
        </nav>
      </div>

      {canWrite && (
        <div className="col-start-2 flex flex-col justify-between gap-4 self-stretch">
          <div className="flex flex-col gap-2 rounded-2xl bg-dark-app p-4">
            <button type="button" onClick={onAdd} className={`${ACTION_BUTTON} bg-solid-green`}>
              + Agregar
            </button>
            <button
              type="button"
              disabled={!selectedRow}
              onClick={() => selectedRow && onEdit(selectedRow.id)}
              title={selectedRow ? undefined : 'Seleccione una partida'}
              className={`${ACTION_BUTTON} bg-darker-app`}
            >
              Editar
            </button>
            <button
              type="button"
              disabled={!selectedRow}
              onClick={() => selectedRow && onPrint(selectedRow.id)}
              title={selectedRow ? undefined : 'Seleccione una partida'}
              className={`${ACTION_BUTTON} bg-solid-purple`}
            >
              Imprimir
            </button>
            <button
              type="button"
              disabled={selectedRow?.estado !== 'vigente'}
              onClick={() => selectedRow && onAnnul(selectedRow.id)}
              title={selectedRow?.estado === 'vigente' ? undefined : 'Seleccione una partida vigente'}
              className={`${ACTION_BUTTON} bg-solid-red`}
            >
              Anular
            </button>
          </div>

          <button type="button" onClick={onPrintIndex} className={`${ACTION_BUTTON} bg-solid-purple`}>
            Imprimir índice
          </button>
        </div>
      )}
    </div>
  );
}
