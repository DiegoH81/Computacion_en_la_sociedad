import { useEffect, useState, type ReactNode } from 'react';
import type { NameColumn, SacramentRecord } from '../../../shared/models';
import { MarginalNoteBadge } from './MarginalNoteBadge';
import { SacramentSearchForm, type SacramentSearchValues, type SearchParish } from './SacramentSearchForm';
import { loadParishes } from '../../controllers/UserController';
import { useSessionStore } from '../../store/sessionStore';
import { parish_label } from '../../../shared/parish_label';
import { StatusBadge } from './ManagementPanel';
import { PageNav, PanelError, PanelTitle, SortPanel, type SortDirection } from '../ui/SearchPanelParts';
import {
  PANEL_ACTION_BUTTON,
  PANEL_CELL,
  PANEL_HEADER_CELL,
  PANEL_MAIN,
  PANEL_NUMBER,
  PANEL_TABLE_BOX,
  panelCheckCellClass,
  panelRowClass,
} from '../ui/panelStyles';

export type { SortDirection } from '../ui/SearchPanelParts';

export interface SacramentColumn<T> {
  header: string;
  render: (row: T) => ReactNode;
}

/**
 * Un dato largo (por ejemplo, una anotación marginal) se corta en dos líneas con "…", para que la fila
 * no crezca; al pasar el mouse se ve entero. El texto completo sigue en el formulario y en la impresión.
 */
function ClampedCell({ content }: { content: ReactNode }) {
  return (
    <div className="line-clamp-2 break-words" title={typeof content === 'string' && content ? content : undefined}>
      {content}
    </div>
  );
}

// Las columnas de siempre ocupan todo el ancho de la tabla; las demás quedan a la derecha y se ven
// con la barra de desplazamiento horizontal (pedido del padre). Cada columna extra mide lo mismo.
const EXTRA_COLUMN_REM = 11;
const NUMBER_COLUMN_REM = 5;

/** Las filas son partidas completas (Baptism o Marriage): se lee su sacramento. */
interface SacramentSearchPanelProps<T extends SacramentRecord> {
  title: string;
  errorMessage: string | null;
  rows: T[];
  columns: SacramentColumn<T>[];
  /** El resto de los datos de la partida: a la derecha de "Estado", fuera de la vista inicial. */
  extraColumns: SacramentColumn<T>[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  sortBy: NameColumn;
  sortDirection: SortDirection;
  onSortChange: (sortBy: NameColumn, direction: SortDirection) => void;
  onSearch: (filters: SacramentSearchValues) => void;
  /** "Padrino o madrina" o "Testigo", para la búsqueda avanzada. */
  godparentLabel: string;
  onClear: () => void;
  /** Falso cuando se consulta una parroquia ajena: solo se puede buscar y ver. */
  canWrite: boolean;
  canManage: (parroquiaId: number) => boolean;
  /** Solo el administrador de la parroquia anula partidas. */
  canAnnul: boolean;
  /** "Editar", o "Pedir cambio" para un usuario (ayudante). */
  editLabel?: string;
  /** Ver el historial de la partida: solo los administradores. */
  onHistory?: (id: number) => void;
  onAdd: () => void;
  onEdit: (id: number) => void;
  onPrint: (id: number) => void;
  onAnnul: (id: number) => void;
  /** Rehabilitar una partida anulada (el mismo administrador que anula). */
  onRestore: (id: number) => void;
  onPrintIndex: () => void;
}

export function SacramentSearchPanel<T extends SacramentRecord>({
  title,
  errorMessage,
  rows,
  columns,
  extraColumns,
  isLoading,
  currentPage,
  totalPages,
  onPageChange,
  sortBy,
  sortDirection,
  onSortChange,
  onSearch,
  godparentLabel,
  onClear,
  canWrite,
  canManage,
  canAnnul,
  editLabel = 'Editar',
  onHistory,
  onAdd,
  onEdit,
  onPrint,
  onAnnul,
  onRestore,
  onPrintIndex,
}: SacramentSearchPanelProps<T>) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [parishes, setParishes] = useState<SearchParish[]>([]);
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);

  // Las parroquias, para buscar en otras o en varias desde la búsqueda avanzada.
  useEffect(() => {
    let cancelled = false;
    loadParishes().then((result) => {
      if (!cancelled && result.success && result.parishes) setParishes(result.parishes);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Si la búsqueda trae partidas de otras parroquias, se muestra de cuál es cada una.
  const showParish = rows.some((row) => row.sacramento.parroquia_id !== parroquiaActivaId);

  function parishName(parishId: number | undefined): string {
    const parish = parishes.find((item) => item.id === parishId);
    return parish ? parish_label(parish) : '';
  }

  const selectedRow = rows.find((row) => row.sacramento.id === selectedId)?.sacramento ?? null;
  // Una partida anulada solo se ve y no se imprime, hasta que se rehabilite.
  const selectedAnnulled = selectedRow?.estado === 'anulado';

  // Doble clic: otra forma de abrir la partida para editarla (o para pedir un cambio).
  function handleDoubleClick(id: number) {
    setSelectedId(id);
    onEdit(id);
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_14rem] gap-4">
      <PanelTitle>{title}</PanelTitle>

      <PanelError message={errorMessage} />

      <SacramentSearchForm
        isLoading={isLoading}
        godparentLabel={godparentLabel}
        parishes={parishes}
        currentParishId={parroquiaActivaId}
        onSearch={onSearch}
        onClear={onClear}
      />

      <SortPanel sortBy={sortBy} sortDirection={sortDirection} onSortChange={onSortChange} />

      <div className="col-start-1 flex flex-col gap-3 rounded-2xl bg-table-panel p-4">
        {/* containerType: así la tabla puede medir "todo el ancho visible" (100cqw). */}
        <div className={PANEL_TABLE_BOX} style={{ containerType: 'inline-size' }}>
          {isLoading || rows.length === 0 ? (
            <p className="p-4 text-slate-700">
              {isLoading ? 'Cargando...' : 'No se encontraron partidas.'}
            </p>
          ) : (
            <table
              className="table-fixed border-separate border-spacing-0 text-left"
              style={{ width: `calc(100cqw + ${extraColumns.length * EXTRA_COLUMN_REM}rem)` }}
            >
              <colgroup>
                {canWrite && <col className="w-11" />}
                {showParish && <col />}
                <col style={{ width: `${NUMBER_COLUMN_REM}rem` }} />
                <col style={{ width: `${NUMBER_COLUMN_REM}rem` }} />
                <col style={{ width: `${NUMBER_COLUMN_REM}rem` }} />
                {columns.map((column) => (
                  <col key={column.header} />
                ))}
                <col className="w-32" />
                <col className="w-28" />
                {extraColumns.map((column) => (
                  <col key={column.header} style={{ width: `${EXTRA_COLUMN_REM}rem` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {canWrite && <th aria-label="Seleccionar" className={`${PANEL_HEADER_CELL} w-11`} />}
                  {showParish && <th className={PANEL_HEADER_CELL}>Parroquia</th>}
                  <th className={`${PANEL_HEADER_CELL} ${PANEL_NUMBER}`}>Libro</th>
                  <th className={`${PANEL_HEADER_CELL} ${PANEL_NUMBER}`}>Folio</th>
                  <th className={`${PANEL_HEADER_CELL} ${PANEL_NUMBER}`}>Registro</th>
                  {columns.map((column) => (
                    <th key={column.header} className={PANEL_HEADER_CELL}>
                      {column.header}
                    </th>
                  ))}
                  <th className={PANEL_HEADER_CELL}>Notas</th>
                  <th className={PANEL_HEADER_CELL}>Estado</th>
                  {extraColumns.map((column) => (
                    <th key={column.header} className={PANEL_HEADER_CELL}>
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const sacramento = row.sacramento;
                  const id = sacramento.id as number;
                  const selectable = canWrite && canManage(sacramento.parroquia_id as number);
                  const isSelected = selectedRow?.id === id;
                  const isAnnulled = sacramento.estado === 'anulado';

                  return (
                    <tr
                      key={id}
                      onClick={
                        selectable ? () => setSelectedId(isSelected ? null : id) : undefined
                      }
                      onDoubleClick={selectable ? () => handleDoubleClick(id) : undefined}
                      className={panelRowClass(selectable, isSelected, isAnnulled)}
                    >
                      {canWrite && (
                        <td className={panelCheckCellClass(isSelected)}>
                          {selectable && (
                            <input
                              type="checkbox"
                              readOnly
                              checked={isSelected}
                              aria-label={`Seleccionar partida ${sacramento.numero}`}
                              className="block h-5 w-5 cursor-pointer accent-darker-app"
                            />
                          )}
                        </td>
                      )}
                      {showParish && <td className={PANEL_CELL}>{parishName(sacramento.parroquia_id)}</td>}
                      <td className={`${PANEL_CELL} ${PANEL_NUMBER}`}>{sacramento.libro}</td>
                      <td className={`${PANEL_CELL} ${PANEL_NUMBER}`}>{sacramento.folio}</td>
                      <td className={`${PANEL_CELL} ${PANEL_NUMBER}`}>{sacramento.numero}</td>
                      {columns.map((column, index) => (
                        <td key={column.header} className={`${PANEL_CELL} ${index === 0 ? PANEL_MAIN : ''}`}>
                          <ClampedCell content={column.render(row)} />
                        </td>
                      ))}
                      <td className={PANEL_CELL}>
                        <MarginalNoteBadge record={row} />
                      </td>
                      <td className={PANEL_CELL}>
                        <StatusBadge label={isAnnulled ? 'Anulada' : 'Vigente'} tone={isAnnulled ? 'alert' : 'on'} />
                      </td>
                      {extraColumns.map((column) => (
                        <td key={column.header} className={PANEL_CELL}>
                          <ClampedCell content={column.render(row)} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <PageNav currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
      </div>

      {canWrite && (
        <div className="col-start-2 flex flex-col justify-between gap-4 self-stretch">
          <div className="flex flex-col gap-2 rounded-2xl bg-dark-app p-4">
            <button type="button" onClick={onAdd} className={`${PANEL_ACTION_BUTTON} bg-solid-green`}>
              + Agregar
            </button>
            <button
              type="button"
              disabled={!selectedRow}
              onClick={() => selectedRow && onEdit(selectedRow.id as number)}
              title={selectedRow ? undefined : 'Seleccione una partida'}
              className={`${PANEL_ACTION_BUTTON} bg-darker-app`}
            >
              {selectedAnnulled ? 'Ver' : editLabel}
            </button>
            <button
              type="button"
              disabled={!selectedRow || selectedAnnulled}
              onClick={() => selectedRow && onPrint(selectedRow.id as number)}
              title={!selectedRow ? 'Seleccione una partida' : selectedAnnulled ? 'Una partida anulada no se imprime' : undefined}
              className={`${PANEL_ACTION_BUTTON} bg-solid-purple`}
            >
              Imprimir
            </button>
            {onHistory && (
              <button
                type="button"
                disabled={!selectedRow}
                onClick={() => selectedRow && onHistory(selectedRow.id as number)}
                title={selectedRow ? undefined : 'Seleccione una partida'}
                className={`${PANEL_ACTION_BUTTON} bg-icon-button`}
              >
                Historial
              </button>
            )}
            {/* Anular una partida vigente; con una anulada seleccionada, el botón la rehabilita. */}
            {canAnnul && selectedRow?.estado === 'anulado' ? (
              <button
                type="button"
                onClick={() => onRestore(selectedRow.id as number)}
                className={`${PANEL_ACTION_BUTTON} bg-solid-green`}
              >
                Rehabilitar
              </button>
            ) : (
              canAnnul && (
                <button
                  type="button"
                  disabled={selectedRow?.estado !== 'vigente'}
                  onClick={() => selectedRow && onAnnul(selectedRow.id as number)}
                  title={selectedRow?.estado === 'vigente' ? undefined : 'Seleccione una partida vigente'}
                  className={`${PANEL_ACTION_BUTTON} bg-solid-red`}
                >
                  Anular
                </button>
              )
            )}
          </div>

          <button type="button" onClick={onPrintIndex} className={`${PANEL_ACTION_BUTTON} bg-solid-purple`}>
            Imprimir índice
          </button>
        </div>
      )}
    </div>
  );
}
