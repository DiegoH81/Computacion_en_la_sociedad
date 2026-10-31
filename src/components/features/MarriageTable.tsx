import { useState } from 'react';

interface MarriageRow {
  id: number;
  parroquiaId: number;
  parroquiaNombre: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
  esposoNombreCompleto: string;
  esposaNombreCompleto: string;
  estado: 'vigente' | 'anulado';
}

interface MarriageTableProps {
  marriages: MarriageRow[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (id: number) => void;
  onPrint: (id: number) => void;
  onPrintSelected: (ids: number[]) => void;
  onAnnul: (id: number) => void;
  canManage: (parroquiaId: number) => boolean;
  isLoading: boolean;
}

export function MarriageTable({
  marriages,
  currentPage,
  totalPages,
  onPageChange,
  onEdit,
  onPrint,
  onPrintSelected,
  onAnnul,
  canManage,
  isLoading,
}: MarriageTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

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

  if (marriages.length === 0) {
    return <p className="p-4 text-sm text-slate-500">No se encontraron partidas.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-md bg-slate-100 px-4 py-2">
          <span className="text-sm text-slate-600">{selectedIds.size} seleccionadas</span>
          <button
            type="button"
            onClick={() => onPrintSelected(Array.from(selectedIds))}
            className="rounded-md bg-blue-700 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-600"
          >
            Imprimir seleccionadas
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2"></th>
              <th className="px-4 py-2">Parroquia</th>
              <th className="px-4 py-2">Libro</th>
              <th className="px-4 py-2">Folio</th>
              <th className="px-4 py-2">Registro</th>
              <th className="px-4 py-2">Esposo</th>
              <th className="px-4 py-2">Esposa</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {marriages.map((marriage) => {
              const editable = canManage(marriage.parroquiaId);
              return (
                <tr key={marriage.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(marriage.id)}
                      onChange={() => toggleSelected(marriage.id)}
                    />
                  </td>
                  <td className="px-4 py-2">{marriage.parroquiaNombre}</td>
                  <td className="px-4 py-2">{marriage.numeroLibro}</td>
                  <td className="px-4 py-2">{marriage.numeroFolio}</td>
                  <td className="px-4 py-2">{marriage.numeroRegistro}</td>
                  <td className="px-4 py-2">{marriage.esposoNombreCompleto}</td>
                  <td className="px-4 py-2">{marriage.esposaNombreCompleto}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        marriage.estado === 'vigente'
                          ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700'
                          : 'rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700'
                      }
                    >
                      {marriage.estado === 'vigente' ? 'Vigente' : 'Anulado'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      {editable && (
                        <button
                          type="button"
                          onClick={() => onEdit(marriage.id)}
                          className="rounded-md bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-500"
                        >
                          Editar
                        </button>
                      )}
                      {editable && marriage.estado === 'vigente' && (
                        <button
                          type="button"
                          onClick={() => onAnnul(marriage.id)}
                          className="rounded-md bg-red-700 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600"
                        >
                          Anular
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onPrint(marriage.id)}
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
