import { useState, type ReactNode } from 'react';
import type { NameColumn } from '../../../shared/models';
import {
  NameSearchForm,
  PageNav,
  PanelError,
  PanelTitle,
  ParishFilter,
  SortPanel,
  type SearchValues,
  type SortDirection,
} from '../ui/SearchPanelParts';
import {
  PANEL_ACTION_BUTTON,
  PANEL_CELL,
  PANEL_HEADER_CELL,
  PANEL_MAIN,
  PANEL_TABLE_BOX,
  panelCheckCellClass,
  panelRowClass,
} from '../ui/panelStyles';

export interface ManagementColumn<T> {
  header: string;
  render: (row: T) => ReactNode;
  /** El dato principal de la fila (el nombre): va en semi-negrita. */
  isMain?: boolean;
}

/** Un botón de la barra de la derecha. Actúa sobre la fila marcada. */
export interface ManagementAction<T> {
  /** Puede depender de la fila marcada, como Deshabilitar o Habilitar. */
  label: (row: T | null) => string;
  /** Clase de color de Tailwind, como bg-solid-red. */
  color: string;
  isEnabled: (row: T) => boolean;
  onClick: (row: T) => void;
}

/** Buscador por nombre con orden y paginación. Parroquias no lo usa: son pocas. */
export interface ManagementSearch {
  firstLabel: string;
  sortBy: NameColumn;
  sortDirection: SortDirection;
  onSortChange: (sortBy: NameColumn, direction: SortDirection) => void;
  onSearch: (filters: SearchValues) => void;
  onClear: () => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Filtro por parroquia. null es "todas". */
  parishFilter?: {
    parishes: { id: number; nombre: string }[];
    value: number | null;
    onChange: (parishId: number | null) => void;
  };
}

interface ManagementPanelProps<T> {
  title: string;
  /** Texto corto bajo el título. */
  notice?: string;
  errorMessage: string | null;
  rows: T[];
  getRowId: (row: T) => number;
  /** Texto del check de cada fila, para lectores de pantalla y pruebas. */
  getRowLabel: (row: T) => string;
  columns: ManagementColumn<T>[];
  emptyText: string;
  isLoading: boolean;
  search?: ManagementSearch;
  /** Sin onAdd ni filas marcables, la barra de la derecha no se muestra (solo lectura). */
  onAdd?: () => void;
  isSelectable: (row: T) => boolean;
  actions: ManagementAction<T>[];
}

/** Lista de ministros, usuarios o parroquias, con el mismo aspecto que la de partidas. */
export function ManagementPanel<T>({
  title,
  notice,
  errorMessage,
  rows,
  getRowId,
  getRowLabel,
  columns,
  emptyText,
  isLoading,
  search,
  onAdd,
  isSelectable,
  actions,
}: ManagementPanelProps<T>) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Si la fila marcada ya no está en la lista (otra página, otra búsqueda), no hay nada marcado.
  const selectedRow = rows.find((row) => getRowId(row) === selectedId && isSelectable(row)) ?? null;
  const hasSelectableRows = rows.some(isSelectable);
  const showActions = onAdd !== undefined || hasSelectableRows;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_14rem] gap-4">
      <PanelTitle>{title}</PanelTitle>

      {notice && (
        <p className="col-start-1 rounded-lg bg-lighter-green px-4 py-2 text-sm text-slate-800">{notice}</p>
      )}

      <PanelError message={errorMessage} />

      {search && (
        <>
          <NameSearchForm
            firstLabel={search.firstLabel}
            isLoading={isLoading}
            onSearch={search.onSearch}
            onClear={search.onClear}
            extraFilter={search.parishFilter && <ParishFilter {...search.parishFilter} />}
          />
          <SortPanel sortBy={search.sortBy} sortDirection={search.sortDirection} onSortChange={search.onSortChange} />
        </>
      )}

      <div className="col-start-1 flex flex-col gap-3 rounded-2xl bg-table-panel p-4">
        <div className={PANEL_TABLE_BOX}>
          {isLoading || rows.length === 0 ? (
            <p className="p-4 text-slate-700">{isLoading ? 'Cargando...' : emptyText}</p>
          ) : (
            <table className="w-full border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  {hasSelectableRows && <th aria-label="Seleccionar" className={`${PANEL_HEADER_CELL} w-11`} />}
                  {columns.map((column) => (
                    <th key={column.header} className={PANEL_HEADER_CELL}>
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const id = getRowId(row);
                  const selectable = isSelectable(row);
                  const isSelected = selectedRow !== null && getRowId(selectedRow) === id;

                  return (
                    <tr
                      key={id}
                      onClick={selectable ? () => setSelectedId(isSelected ? null : id) : undefined}
                      className={panelRowClass(selectable, isSelected)}
                    >
                      {hasSelectableRows && (
                        <td className={panelCheckCellClass(isSelected)}>
                          {selectable && (
                            <input
                              type="checkbox"
                              readOnly
                              checked={isSelected}
                              aria-label={`Seleccionar ${getRowLabel(row)}`}
                              className="block h-5 w-5 cursor-pointer accent-darker-app"
                            />
                          )}
                        </td>
                      )}
                      {columns.map((column) => (
                        <td key={column.header} className={`${PANEL_CELL} ${column.isMain ? PANEL_MAIN : ''}`}>
                          {column.render(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {search && (
          <PageNav currentPage={search.currentPage} totalPages={search.totalPages} onPageChange={search.onPageChange} />
        )}
      </div>

      {showActions && (
        <div className="col-start-2 flex flex-col gap-2 self-start rounded-2xl bg-dark-app p-4">
          {onAdd && (
            <button type="button" onClick={onAdd} className={`${PANEL_ACTION_BUTTON} bg-solid-green`}>
              + Agregar
            </button>
          )}
          {actions.map((action, index) => {
            const enabled = selectedRow !== null && action.isEnabled(selectedRow);
            const label = action.label(selectedRow);

            return (
              <button
                key={index}
                type="button"
                disabled={!enabled}
                onClick={() => selectedRow && action.onClick(selectedRow)}
                title={selectedRow ? undefined : 'Seleccione una fila'}
                className={`${PANEL_ACTION_BUTTON} ${action.color}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * La columna Estado de las cuatro tablas: un punto de color y el texto.
 * tone: "on" (habilitado, vigente), "off" (deshabilitado) o "alert" (anulada, en rojo).
 */
export function StatusBadge({ label, tone }: { label: string; tone: 'on' | 'off' | 'alert' }) {
  const dot = { on: 'bg-solid-green', off: 'bg-slate-400', alert: 'bg-solid-red' }[tone];
  const text = tone === 'alert' ? 'font-semibold text-solid-red' : '';

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${text}`}>
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

/** Estado de un ministro, usuario o parroquia. feminine: "Habilitada" en vez de "Habilitado". */
export function ActiveStatus({ isActive, feminine = false }: { isActive: boolean; feminine?: boolean }) {
  const ending = feminine ? 'a' : 'o';
  return <StatusBadge label={isActive ? `Habilitad${ending}` : `Deshabilitad${ending}`} tone={isActive ? 'on' : 'off'} />;
}

/** Etiqueta pequeña junto a un dato de la tabla, como "Anulado" en las partidas. */
export function RowBadge({ color, children }: { color: string; children: string }) {
  return <span className={`ml-2 rounded px-1 text-xs text-white ${color}`}>{children}</span>;
}
