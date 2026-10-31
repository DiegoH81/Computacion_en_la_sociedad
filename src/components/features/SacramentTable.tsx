import { useState, type ReactNode } from 'react';

export interface SacramentRowBase {
  id: number;
  parroquiaId: number;
  parroquiaNombre: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
  estado: 'vigente' | 'anulado';
}

interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
}

interface SacramentTableProps<T extends SacramentRowBase> {
  rows: T[];
  columns: Column<T>[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (id: number) => void;
  onPrint: (id: number) => void;
  onAnnul: (id: number) => void;
  canManage: (parroquiaId: number) => boolean;
  isLoading: boolean;
  /** Si se provee, habilita checkboxes de selección y el botón de imprimir seleccionadas. */
  onPrintSelected?: (ids: number[]) => void;
  /** Si no se provee onPrintSelected, se puede usar este botón simple ("Imprimir toda la lista"). */
  onPrintAllResults?: () => void;
}

export function SacramentTable<T extends SacramentRowBase>({
  rows,
  columns,
  currentPage,
  totalPages,
  onPageChange,
  onEdit,
  onPrint,
  onAnnul,
  canManage,
  isLoading,
  onPrintSelected,
  onPrintAllResults,
}: SacramentTableProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const hasMultiSelect = Boolean(onPrintSelected);

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (isLoading) {
    return <p className="p-4 text-sm text-slate-500">Cargando...</p>;
  }

  if (rows.length === 0) {
    return <p className="p-4 text-sm text-slate-500">No se encontraron partidas.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {hasMultiSelect && selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-md bg-slate-100 px-4 py-2">
          <span className="text-sm text-slate-600">{selectedIds.size} seleccionadas</span>
          <button
            type="button"
            onClick={() => onPrintSelected?.(Array.from(selectedIds))}
            className="rounded-md bg-blue-700 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-600"
          >
            Imprimir seleccionadas
          </button>
        </div>
      )}

      {!hasMultiSelect && onPrintAllResults && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onPrintAllResults}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
          >
            Imprimir toda la lista
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              {hasMultiSelect && <th className="px-4 py-2"></th>}
              {columns.map((col) => (
                <th key={col.header} className="px-4 py-2">
                  {col.header}
                </th>
              ))}
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const editable = canManage(row.parroquiaId);
              return (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  {hasMultiSelect && (
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelected(row.id)}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.header} className="px-4 py-2">
                      {col.render(row)}
                    </td>
                  ))}
                  <td className="px-4 py-2">
                    <span
                      className={
                        row.estado === 'vigente'
                          ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700'
                          : 'rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700'
                      }
                    >
                      {row.estado === 'vigente' ? 'Vigente' : 'Anulado'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      {editable && (
                        <button
                          type="button"
                          onClick={() => onEdit(row.id)}
                          className="rounded-md bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-500"
                        >
                          Editar
                        </button>
                      )}
                      {editable && row.estado === 'vigente' && (
                        <button
                          type="button"
                          onClick={() => onAnnul(row.id)}
                          className="rounded-md bg-red-700 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600"
                        >
                          Anular
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onPrint(row.id)}
                        className="rounded-md bg-blue-700 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-600"
                      >
                        Imprimir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="rounded-md px-3 py-1 disabled:opacity-30"
        >
          ← Previous
        </button>
        <span className="text-slate-600">
          Página {currentPage} de {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="rounded-md px-3 py-1 disabled:opacity-30"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
